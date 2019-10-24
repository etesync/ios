import * as EteSync from '../api/EteSync';
import { Action } from 'redux-actions';

import { CURRENT_VERSION } from '../api/Constants';

import { syncInfoSelector } from '../SyncHandler';
import { store, persistor, CredentialsData, JournalsData, SyncStateJournalData, SyncStateEntryData } from '../store';
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo } from '../store/actions';

import { SyncManagerAddressBook } from './SyncManagerAddressBook';
import { SyncManagerCalendar } from './SyncManagerCalendar';
import { SyncManagerTaskList } from './SyncManagerTaskList';

import * as sjcl from 'sjcl';
import * as Random from 'expo-random';

async function prngAddEntropy() {
  const entropyBits = 1024;
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

  constructor(etesync: CredentialsData) {
    this.etesync = etesync;
  }

  public async fetchAllJournals() {
    const entries = store.getState().cache.entries;
    const etesync = this.etesync;
    const me = etesync.credentials.email;

    const userInfoAction = await store.dispatch(fetchUserInfo(etesync, me));
    let userInfo = userInfoAction.payload;
    if (userInfoAction.error || !userInfoAction.payload) {
      const newUserInfo = new EteSync.UserInfo(me, CURRENT_VERSION);
      const keyPair = await EteSync.AsymmetricCryptoManager.generateKeyPair();
      const cryptoManager = newUserInfo.getCryptoManager(etesync.encryptionKey);

      newUserInfo.setKeyPair(cryptoManager, keyPair);

      userInfo = (await store.dispatch<any>(createUserInfo(etesync, newUserInfo))).payload;
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
          await store.dispatch(fetchEntries(etesync, collection.uid));
        }
      }
    }
  }

  public async sync() {
    prngAddEntropy();
    await this.fetchAllJournals();

    const storeState = store.getState();
    const entries = storeState.cache.entries;
    const journals = storeState.cache.journals as JournalsData; // FIXME: no idea why we need this cast.
    const userInfo = storeState.cache.userInfo;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncStateEntries = storeState.sync.stateEntries;
    const syncInfo = syncInfoSelector({ etesync: this.etesync, entries, journals, userInfo });

    // FIXME: make the sync parallel.
    const managers = [SyncManagerCalendar, SyncManagerTaskList, SyncManagerAddressBook];
    managers.pop(); // FIXME: Removing the address book as it's not yet supported.
    for (const syncManager of managers.map((ManagerClass) => new ManagerClass(this.etesync, userInfo))) {
      await syncManager.init();
      await syncManager.sync(syncInfo, syncStateJournals, syncStateEntries);
    }

    // Force flusing the store to disk
    persistor.persist();

    return true;
  }
}
