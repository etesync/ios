import { List, Map } from 'immutable';
import { createSelector } from 'reselect';

import * as EteSync from './api/EteSync';
import { byte } from './api/Helpers';

import { store, JournalsData, EntriesData, CredentialsData, UserInfoData } from './store';
import { setSyncInfoCollection, setSyncInfoItem, unsetSyncInfoCollection } from './store/actions';

export interface SyncInfoJournal {
  journal: EteSync.Journal;
  derivedJournalKey?: byte[];
  journalEntries: List<EteSync.Entry>;
  collection: EteSync.CollectionInfo;
  entries: List<EteSync.SyncEntry>;
}

export type SyncInfo = Map<string, SyncInfoJournal>;

interface SyncInfoSelectorProps {
  etesync: CredentialsData;
  journals: JournalsData;
  entries: EntriesData;
  userInfo: UserInfoData;
}

export const syncInfoSelector = createSelector(
  (props: SyncInfoSelectorProps) => props.etesync,
  (props: SyncInfoSelectorProps) => props.journals,
  (props: SyncInfoSelectorProps) => props.entries,
  (props: SyncInfoSelectorProps) => props.userInfo,
  (etesync, journals, entries, userInfo) => {
    const syncInfoCollection = store.getState().cache.syncInfoCollection;
    const syncInfoItem = store.getState().cache.syncInfoItem;
    const derived = etesync.encryptionKey;
    const userInfoCryptoManager = userInfo.getCryptoManager(etesync.encryptionKey);
    let asymmetricCryptoManager: EteSync.AsymmetricCryptoManager;
    try {
      userInfo.verify(userInfoCryptoManager);
    } catch (error) {
      if (error instanceof EteSync.IntegrityError) {
        throw new EteSync.EncryptionPasswordError(error.message);
      } else {
        throw error;
      }
    }

    const ret = Map<string, SyncInfoJournal>().asMutable();
    journals.forEach((journal) => {
      const journalEntries = entries.get(journal.uid);
      let prevUid: string | null = null;

      if (!journalEntries) {
        return;
      }

      let cryptoManager: EteSync.CryptoManager;
      let derivedJournalKey: byte[] | undefined;
      if (journal.key) {
        if (!asymmetricCryptoManager) {
          const keyPair = userInfo.getKeyPair(userInfoCryptoManager);
          asymmetricCryptoManager = new EteSync.AsymmetricCryptoManager(keyPair);
        }
        derivedJournalKey = asymmetricCryptoManager.decryptBytes(journal.key);
        cryptoManager = EteSync.CryptoManager.fromDerivedKey(derivedJournalKey, journal.version);
      } else {
        cryptoManager = new EteSync.CryptoManager(derived, journal.uid, journal.version);
      }

      const collectionInfo = journal.getInfo(cryptoManager);
      store.dispatch(setSyncInfoCollection(etesync, collectionInfo));

      const syncEntries = journalEntries.map((entry: EteSync.Entry) => {
        const cacheEntry = syncInfoItem.getIn([journal.uid, entry.uid]);
        if (cacheEntry) {
          prevUid = entry.uid;
          return cacheEntry;
        }

        const syncEntry = entry.getSyncEntry(cryptoManager, prevUid);
        prevUid = entry.uid;

        store.dispatch(setSyncInfoItem(etesync, journal.uid, syncEntry as any));
        return syncEntry;
      });

      ret.set(journal.uid, {
        entries: syncEntries,
        collection: collectionInfo,
        journal,
        derivedJournalKey,
        journalEntries,
      });
    });

    for (const collection of syncInfoCollection.values()) {
      if (!ret.has(collection.uid)) {
        store.dispatch(unsetSyncInfoCollection(etesync, collection));
      }
    }

    return ret.asImmutable();
  }
);
