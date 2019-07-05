import * as EteSync from '../api/EteSync';
import { Action } from 'redux-actions';

import { CURRENT_VERSION } from '../api/Constants';

import { syncInfoSelector } from '../SyncHandler';
import { store, EntriesType, JournalsType, UserInfoType, CredentialsData, SyncStateJournalData, SyncStateEntryData } from '../store';
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo } from '../store/actions';

// import { SyncManagerAddressBook } from './SyncManagerAddressBook';
import { SyncManagerCalendar } from './SyncManagerCalendar';

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

    let userInfo = await store.dispatch<any>(fetchUserInfo(etesync, me));
    if (!userInfo) {
      const newUserInfo = new EteSync.UserInfo(me, CURRENT_VERSION);
      const keyPair = await EteSync.AsymmetricCryptoManager.generateKeyPair();
      const cryptoManager = new EteSync.CryptoManager(etesync.encryptionKey, 'userInfo');

      newUserInfo.setKeyPair(cryptoManager, keyPair);

      userInfo = await store.dispatch<any>(createUserInfo(etesync, newUserInfo));
    }

    const haveJournals = await store.dispatch<any>(fetchAll(etesync, entries as any));
    if (!haveJournals) {
      for (const collectionType of ['ADDRESS_BOOK', 'CALENDAR', 'TASKS']) {
        const collection = new EteSync.CollectionInfo();
        collection.uid = EteSync.genUid();
        collection.type = collectionType;
        collection.displayName = 'Default';

        const journal = new EteSync.Journal();
        const cryptoManager = new EteSync.CryptoManager(etesync.encryptionKey, collection.uid);
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
    await this.fetchAllJournals();

    const storeState = store.getState();
    const entries = storeState.cache.entries as unknown as EntriesType;
    const journals = storeState.cache.journals as unknown as JournalsType;
    const userInfo = storeState.cache.userInfo as unknown as UserInfoType;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncStateEntries = storeState.sync.stateEntries;
    const syncInfo = await syncInfoSelector({ etesync: this.etesync, entries, journals, userInfo });

    // FIXME: also sync address book
    for (const syncManager of [new SyncManagerCalendar(this.etesync)]) {
      await syncManager.init();
      await syncManager.sync(syncInfo, syncStateJournals, syncStateEntries);
    }
  }
}
