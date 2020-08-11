// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { Notifications } from "expo";
import { activateKeepAwake, deactivateKeepAwake } from "expo-keep-awake";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as Permissions from "expo-permissions";

import { beginBackgroundTask, endBackgroundTask } from "../EteSyncNative";

import * as EteSync from "etesync";

const CURRENT_VERSION = EteSync.CURRENT_VERSION;

import { syncInfoSelector } from "../SyncHandler";
import { store, persistor, CredentialsData, JournalsData, StoreState, CredentialsDataRemote } from "../store";
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo, addNonFatalError } from "../store/actions";

import { logger } from "../logging";

import { SyncManagerAddressBook } from "./SyncManagerAddressBook";
import { SyncManagerCalendar } from "./SyncManagerCalendar";
import { SyncManagerTaskList } from "./SyncManagerTaskList";

import sjcl from "sjcl";
import * as Random from "expo-random";
import { credentialsSelector } from "../login";
import { startTask } from "../helpers";

async function prngAddEntropy(entropyBits = 1024) {
  const bytes = await Random.getRandomBytesAsync(entropyBits / 8);
  const buf = new Uint32Array(new Uint8Array(bytes).buffer);
  sjcl.random.addEntropy(buf as any, entropyBits, "Random.getRandomBytesAsync");
}
// we seed the entropy in the beginning + on every sync
prngAddEntropy();

const cachedSyncManager = new Map<string, SyncManager>();
export class SyncManager {
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

  protected etesync: CredentialsData;
  protected userInfo: EteSync.UserInfo;
  protected isSyncing: boolean;

  private managers = [
    SyncManagerCalendar,
    SyncManagerTaskList,
    SyncManagerAddressBook,
  ];

  public async fetchAllJournals() {
    const storeState = store.getState() as StoreState;
    const entries = storeState.cache.entries;
    const etesync = credentialsSelector(storeState)!;
    const me = etesync.credentials.email;

    let userInfoAction;
    try {
      userInfoAction = await store.dispatch(fetchUserInfo(etesync, me));
    } catch (e) {
      // 404 menas we don't have a user info.
      if (!((e instanceof EteSync.HTTPError) && (e.status === 404))) {
        throw e;
      }
    }

    let userInfo;
    if (!userInfoAction || userInfoAction.error || !userInfoAction.payload) {
      userInfo = new EteSync.UserInfo(me, CURRENT_VERSION);
      await prngAddEntropy(4096); // Generating keypair needs a lot of entropy. Make sure to generate enough.
      const keyPair = EteSync.AsymmetricCryptoManager.generateKeyPair();
      const cryptoManager = userInfo.getCryptoManager(etesync.encryptionKey);

      userInfo.setKeyPair(cryptoManager, keyPair);

      await store.dispatch(createUserInfo(etesync, userInfo));
    } else {
      userInfo = await userInfoAction.payload;
    }

    const haveJournals = await store.dispatch<any>(fetchAll(etesync, entries));
    if (!haveJournals) {
      const collectionDescs = [
        {
          type: "ADDRESS_BOOK",
          name: "My Contacts",
        },
        {
          type: "CALENDAR",
          name: "My Calendar",
        },
        {
          type: "TASKS",
          name: "My Tasks",
        },
      ];

      for (const collectionDesc of collectionDescs) {
        const collection = new EteSync.CollectionInfo();
        collection.uid = EteSync.genUid();
        collection.type = collectionDesc.type;
        collection.displayName = collectionDesc.name;

        const journal = new EteSync.Journal({ uid: collection.uid });
        const keyPair = userInfo.getKeyPair(userInfo.getCryptoManager(etesync.encryptionKey));
        const cryptoManager = journal.getCryptoManager(etesync.encryptionKey, keyPair);
        journal.setInfo(cryptoManager, collection);
        try {
          const journalAction = addJournal(etesync, journal);
          await journalAction.payload;
          // FIXME: Limit based on error code to only do it for associates.
          if (!journalAction.error) {
            await store.dispatch(journalAction);
            await store.dispatch(fetchEntries(etesync, collection.uid, null));
          }
        } catch (e) {
          // FIXME: Limit based on error code to only do it for associates.
          logger.warn(e);
        }
      }
    }
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
      prngAddEntropy();
      await this.fetchAllJournals();

      const storeState = store.getState() as StoreState;
      const etesync = credentialsSelector(storeState)!;
      const entries = storeState.cache.entries;
      const journals = storeState.cache.journals as JournalsData; // FIXME: no idea why we need this cast.
      const userInfo = storeState.cache.userInfo!;
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
    } catch (e) {
      if (e instanceof EteSync.NetworkError) {
        // Ignore network errors
        return false;
      } else if (e instanceof EteSync.HTTPError) {
        switch (e.status) {
          case 401: // INVALID TOKEN
          case 403: // FORBIDDEN
          case 503: // UNAVAILABLE
            store.dispatch(addNonFatalError(this.etesync, e));
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
    const etesync = credentialsSelector(storeState)!;
    const userInfo = storeState.cache.userInfo!;

    for (const syncManager of managers.map((ManagerClass) => new ManagerClass(etesync, userInfo))) {
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

    const syncManager = SyncManager.getManager(etesync);
    const sync = syncManager.fetchAllJournals();
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
