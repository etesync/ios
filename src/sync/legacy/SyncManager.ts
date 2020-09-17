// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { activateKeepAwake, deactivateKeepAwake } from "expo-keep-awake";

import { beginBackgroundTask, endBackgroundTask } from "../../EteSyncNative";

import * as EteSync from "etesync";

const CURRENT_VERSION = EteSync.CURRENT_VERSION;

import { syncInfoSelector } from "../../SyncHandler";
import { store, persistor, CredentialsData, JournalsData, StoreState } from "../../store";
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo, addNonFatalError } from "../../store/actions";

import { logger } from "../../logging";

import { SyncManagerAddressBook } from "./SyncManagerAddressBook";
import { SyncManagerCalendar } from "./SyncManagerCalendar";
import { SyncManagerTaskList } from "./SyncManagerTaskList";

import sjcl from "sjcl";
import * as Random from "expo-random";
import { credentialsSelector } from "../../login";

async function prngAddEntropy(entropyBits = 1024) {
  const bytes = await Random.getRandomBytesAsync(entropyBits / 8);
  const buf = new Uint32Array(new Uint8Array(bytes).buffer);
  sjcl.random.addEntropy(buf as any, entropyBits, "Random.getRandomBytesAsync");
}
// we seed the entropy in the beginning + on every sync
prngAddEntropy();

export class SyncManager {
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
