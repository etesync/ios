import * as EteSync from '../api/EteSync';
import { Action } from 'redux-actions';

import { CURRENT_VERSION } from '../api/Constants';

import { SyncInfo } from '../SyncGate';
import { store, CredentialsData, SyncStateJournalData, SyncStateEntryData } from '../store';
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo } from '../store/actions';


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

  public async init() {
    //
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

  public async sync(syncInfo: SyncInfo, syncStateJournals: SyncStateJournalData, syncStateEntries: SyncStateEntryData) {
    //
  }
}
