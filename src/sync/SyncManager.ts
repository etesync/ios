// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { Notifications } from "expo";
import { activateKeepAwake, deactivateKeepAwake } from "expo-keep-awake";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as Permissions from "expo-permissions";

import { beginBackgroundTask, endBackgroundTask } from "../EteSyncNative";

import * as Etebase from "etebase";

import { syncInfoSelector } from "../SyncHandler";
import { store, persistor, CredentialsData, JournalsData, StoreState, CredentialsDataRemote } from "../store";
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo, addNonFatalError, setCacheItemMulti, setSyncCollection, setSyncGeneral, unsetCacheCollection, setCacheCollection } from "../store/actions";

import { logger } from "../logging";

import { SyncManagerAddressBook } from "./SyncManagerAddressBook";
import { SyncManagerCalendar } from "./SyncManagerCalendar";
import { SyncManagerTaskList } from "./SyncManagerTaskList";
import { credentialsSelector } from "../credentials";
import { startTask } from "../helpers";


const cachedSyncManager = new Map<string, SyncManager>();
export class SyncManager {
  private COLLECTION_TYPES = ["etebase.vcard", "etebase.vevent", "etebase.vtodo"];
  private BATCH_SIZE = 40;

  public static getManager(etesync: CredentialsDataRemote) {
    const cached = cachedSyncManager.get(etesync.credentials.email);
    if (!__DEV__ && cached) {
      return cached;
    }

    const ret = new SyncManager();
    cachedSyncManager.set(etesync.credentials.email, ret);
    return ret;
  }

  public static removeManager(etesync: CredentialsData) {
    cachedSyncManager.delete(etesync.credentials.email);
  }

  protected etebase: Etebase.Account;
  protected isSyncing: boolean;

  private managers = [
    SyncManagerCalendar,
    SyncManagerTaskList,
    SyncManagerAddressBook,
  ];

  private async fetchCollection(col: Etebase.Collection) {
    const storeState = store.getState() as unknown as StoreState;
    const etebase = (await credentialsSelector(storeState))!;
    const syncCollection = storeState.sync2.collections.get(col.uid, undefined);

    const colMgr = etebase.getCollectionManager();
    const itemMgr = colMgr.getItemManager(col);

    let stoken = syncCollection?.stoken;
    const limit = this.BATCH_SIZE;
    let done = false;
    while (!done) {
      const items = await itemMgr.list({ stoken, limit });
      store.dispatch(setCacheItemMulti(col.uid, itemMgr, items.data));
      done = items.done;
      stoken = items.stoken;
    }

    if (syncCollection?.stoken !== stoken) {
      store.dispatch(setSyncCollection(col.uid, stoken!));
    }
  }

  public async fetchAllCollections() {
    const storeState = store.getState() as unknown as StoreState;
    const etebase = (await credentialsSelector(storeState))!;
    const syncGeneral = storeState.sync2.general;

    const colMgr = etebase.getCollectionManager();
    const limit = this.BATCH_SIZE;
    let stoken = syncGeneral?.stoken ?? null;
    let done = false;
    while (!done) {
      const collections = await colMgr.list({ stoken, limit });
      for (const col of collections.data) {
        const meta = await col.getMeta();
        if (this.COLLECTION_TYPES.includes(meta.type)) {
          store.dispatch(setCacheCollection(colMgr, col));
          await this.fetchCollection(col);
        }
      }
      if (collections.removedMemberships) {
        for (const removed of collections.removedMemberships) {
          store.dispatch(unsetCacheCollection(colMgr, removed.uid));
        }
      }
      done = collections.done;
      stoken = collections.stoken;
    }

    if (syncGeneral?.stoken !== stoken) {
      store.dispatch(setSyncGeneral(stoken));
    }
    return true;
  }

  public async sync() {
    const keepAwakeTag = "SyncManager";
    const taskId = beginBackgroundTask("Sync");

    if (!store.getState().connection?.isConnected) {
      logger.info("Disconnected, aborting sync");
      return false;
    }

    if (this.isSyncing) {
      return false;
    }
    this.isSyncing = true;

    try {
      activateKeepAwake(keepAwakeTag);
      await this.fetchAllCollections();

      const storeState = store.getState() as StoreState;
      const etesync = credentialsSelector(storeState)!;
      const entries = storeState.cache.entries;
      const journals = storeState.cache.journals as JournalsData; // FIXME: no idea why we need this cast.
      const userInfo = storeState.cache.userInfo!;

      /* FIXME-eb
      syncInfoSelector({ etesync, entries, journals, userInfo });

      // FIXME: make the sync parallel
      for (const syncManager of this.managers.map((ManagerClass) => new ManagerClass(etesync, userInfo))) {
        await syncManager.init();
        if (!syncManager.canSync) {
          continue;
        }
        await syncManager.sync();
      }

      // We do it again here so we decrypt the newly added items too
      syncInfoSelector({ etesync, entries, journals, userInfo });
      */
    } catch (e) {
      if (e instanceof Etebase.NetworkError) {
        // Ignore network errors
        return false;
      } else if (e instanceof Etebase.HTTPError) {
        switch (e.status) {
          case 401: // INVALID TOKEN
          case 403: // FORBIDDEN
          case 503: // UNAVAILABLE
            store.dispatch(addNonFatalError(e));
            return false;
        }
      }
      throw e;
    } finally {
      this.isSyncing = false;
      deactivateKeepAwake(keepAwakeTag);
      endBackgroundTask(await taskId);
    }

    // Force flusing the store to disk
    persistor.persist();

    return true;
  }

  public async clearDeviceCollections(managers = this.managers) {
    const storeState = store.getState() as StoreState;
    const etesync = await credentialsSelector(storeState)!;
    const userInfo = storeState.cache.userInfo!;

    // FIXME-eb
    for (const syncManager of managers.map((ManagerClass) => new ManagerClass(etesync as any, userInfo))) {
      await syncManager.init();
      if (!syncManager.canSync) {
        continue;
      }
      await syncManager.clearDeviceCollections();
    }
  }
}

function persistorLoaded() {
  return new Promise((resolve, _reject) => {
    const subscription = {} as { unsubscribe: () => void };
    subscription.unsubscribe = persistor.subscribe(() => {
      const { bootstrapped } = persistor.getState();
      if (bootstrapped) {
        resolve(true);
        subscription.unsubscribe();
      }
    });
    if (persistor.getState().bootstrapped) {
      resolve(true);
      subscription.unsubscribe();
    }
  });
}

const BACKGROUND_SYNC_TASK_NAME = "SYNCMANAGER_SYNC";

TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
  let timeoutDone = false;
  const timeout = startTask(() => timeoutDone = true, 27 * 1000); // Background fetch is limited to 30 seconds.
  const allowedNotifications = Permissions.getAsync(Permissions.USER_FACING_NOTIFICATIONS).then(({ status }) => (status === Permissions.PermissionStatus.GRANTED));

  try {
    await persistorLoaded();
    const beforeState = store.getState() as StoreState;
    const etesync = credentialsSelector(beforeState);

    if (!etesync) {
      return BackgroundFetch.Result.Failed;
    }

    const syncManager = SyncManager.getManager(etesync as any);
    const sync = syncManager.fetchAllCollections();
    Promise.race([timeout, sync]);

    if (timeoutDone) {
      if (await allowedNotifications) {
        Notifications.presentLocalNotificationAsync({
          title: "Sync Timedout",
          body: `Please contact us and let us know what happened.`,
        });
      }
    }

    const afterState = store.getState();

    const receivedNewData =
      (beforeState.cache.journals !== afterState.cache.journals) ||
      (beforeState.cache.entries !== afterState.cache.entries) ||
      (beforeState.cache.userInfo !== afterState.cache.userInfo);

    if (receivedNewData) {
      if (await allowedNotifications) {
        Notifications.presentLocalNotificationAsync({
          title: "New Data Available",
          body: "Please click here to sync!",
        });
      }
    }

    return receivedNewData ? BackgroundFetch.Result.NewData : BackgroundFetch.Result.NoData;
  } catch (error) {
    if (await allowedNotifications) {
      Notifications.presentLocalNotificationAsync({
        title: "Sync Failed",
        body: `Sync failed, please contact us.\nError: ${error.message}`,
      });
    }
    return BackgroundFetch.Result.Failed;
  }
});

export function registerSyncTask(_username: string) {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME, {
    minimumInterval: 4 * 60 * 60, // 4 hours
  });
}

export function unregisterSyncTask(_username: string) {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
}
