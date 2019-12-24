import { Notifications } from 'expo';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Permissions from 'expo-permissions';

import * as EteSync from 'etesync';
import { Action } from 'redux-actions';

const CURRENT_VERSION = EteSync.CURRENT_VERSION;

import { syncInfoSelector } from '../SyncHandler';
import { store, persistor, CredentialsData, JournalsData, SyncStateJournalData, SyncStateEntryData, StoreState } from '../store';
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo, performSync } from '../store/actions';

import { logger } from '../logging';

import { SyncManagerAddressBook } from './SyncManagerAddressBook';
import { SyncManagerCalendar } from './SyncManagerCalendar';
import { SyncManagerTaskList } from './SyncManagerTaskList';

import sjcl from 'sjcl';
import * as Random from 'expo-random';
import { credentialsSelector } from '../login';

async function prngAddEntropy(entropyBits = 1024) {
  const bytes = await Random.getRandomBytesAsync(entropyBits / 8);
  const buf = new Uint32Array(new Uint8Array(bytes).buffer);
  sjcl.random.addEntropy(buf as any, entropyBits, 'Random.getRandomBytesAsync');
}
// we seed the entropy in the beginning + on every sync
prngAddEntropy();

export class SyncManager {
  public static getManager(etesync: CredentialsData) {
    // FIXME: Should make a singleton per etesync
    return new SyncManager(etesync);
  }

  protected etesync: CredentialsData;
  protected userInfo: EteSync.UserInfo;
  protected collectionType: string;
  protected syncStateJournals: SyncStateJournalData;
  protected syncStateEntries: SyncStateEntryData;

  private managers = [
    SyncManagerCalendar,
    SyncManagerTaskList,
    SyncManagerAddressBook,
  ];

  constructor(etesync: CredentialsData) {
    this.etesync = etesync;
  }

  public async fetchAllJournals() {
    const entries = store.getState().cache.entries;
    const etesync = this.etesync;
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
      for (const collectionType of ['ADDRESS_BOOK', 'CALENDAR', 'TASKS']) {
        const collection = new EteSync.CollectionInfo();
        collection.uid = EteSync.genUid();
        collection.type = collectionType;
        collection.displayName = 'Default';

        const journal = new EteSync.Journal({ uid: collection.uid });
        const keyPair = userInfo.getKeyPair(userInfo.getCryptoManager(etesync.encryptionKey));
        const cryptoManager = journal.getCryptoManager(etesync.encryptionKey, keyPair);
        journal.setInfo(cryptoManager, collection);
        const journalAction: Action<EteSync.Journal> = await store.dispatch<any>(addJournal(etesync, journal));
        // FIXME: Limit based on error code to only do it for associates.
        if (!journalAction.error) {
          await store.dispatch(fetchEntries(etesync, collection.uid, null));
        }
      }
    }
  }

  public async sync() {
    const keepAwakeTag = 'SyncManager';

    if (!store.getState().connection?.isConnected) {
      logger.info('Disconnected, aborting sync');
      return false;
    }

    try {
      activateKeepAwake(keepAwakeTag);
      prngAddEntropy();
      await this.fetchAllJournals();

      const storeState = store.getState();
      const entries = storeState.cache.entries;
      const journals = storeState.cache.journals as JournalsData; // FIXME: no idea why we need this cast.
      const userInfo = storeState.cache.userInfo!;
      syncInfoSelector({ etesync: this.etesync, entries, journals, userInfo });

      // FIXME: make the sync parallel
      for (const syncManager of this.managers.map((ManagerClass) => new ManagerClass(this.etesync, userInfo))) {
        await syncManager.init();
        if (!syncManager.canSync) {
          continue;
        }
        await syncManager.sync();
      }

      // We do it again here so we decrypt the newly added items too
      syncInfoSelector({ etesync: this.etesync, entries, journals, userInfo });
    } catch (e) {
      if (e instanceof EteSync.NetworkError) {
        // Ignore network errors
        return false;
      }
      throw e;
    } finally {
      deactivateKeepAwake(keepAwakeTag);
    }

    // Force flusing the store to disk
    persistor.persist();

    return true;
  }

  public async clearDeviceCollections() {
    const storeState = store.getState();
    const userInfo = storeState.cache.userInfo!;

    for (const syncManager of this.managers.map((ManagerClass) => new ManagerClass(this.etesync, userInfo))) {
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

const BACKGROUND_SYNC_TASK_NAME = 'SYNCMANAGER_SYNC';

TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
  const allowedNotifications = (await Permissions.getAsync(Permissions.USER_FACING_NOTIFICATIONS)).status === Permissions.PermissionStatus.GRANTED;

  try {
    await persistorLoaded();
    const beforeState = store.getState() as StoreState;
    const etesync = credentialsSelector(beforeState);

    const failedSyncNotificationId = (allowedNotifications) ? Notifications.scheduleLocalNotificationAsync(
      {
        title: 'Sync Timedout',
        body: `Please contact developers and let them know what happened.`,
      },
      {
        time: (new Date()).getTime() + 5 * 60 * 1000, // 5 minutes
      }
    ) : undefined;

    if (!etesync) {
      return BackgroundFetch.Result.Failed;
    }

    const syncManager = SyncManager.getManager(etesync);
    const sync = syncManager.sync();
    store.dispatch(performSync(sync));
    await sync;

    const afterState = store.getState();

    const receivedNewData =
      (beforeState.cache.journals !== afterState.cache.journals) ||
      (beforeState.cache.entries !== afterState.cache.entries) ||
      (beforeState.cache.userInfo !== afterState.cache.userInfo);

    if (receivedNewData) {
      if (allowedNotifications) {
        Notifications.presentLocalNotificationAsync({
          title: 'New Data Available',
          body: 'Sync finished successfully and new data was found!',
        });
      }
    }

    if (failedSyncNotificationId) {
      await Notifications.cancelScheduledNotificationAsync(await failedSyncNotificationId);
    }

    return receivedNewData ? BackgroundFetch.Result.NewData : BackgroundFetch.Result.NoData;
  } catch (error) {
    if (allowedNotifications) {
      Notifications.presentLocalNotificationAsync({
        title: 'Sync Failed',
        body: `Sync failed, please contact developers.\nError: ${error.message}`,
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
