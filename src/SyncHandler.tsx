// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { createSelector } from 'reselect';

import * as EteSync from 'etesync';
import { byte } from 'etesync';

import { store, JournalsData, EntriesData, CredentialsData, UserInfoData, SyncInfoItem } from './store';
import { setSyncInfoCollection, setSyncInfoItem, unsetSyncInfoCollection } from './store/actions';

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

    const handled = {};
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

      journalEntries.forEach((entry: EteSync.Entry) => {
        const cacheEntry = syncInfoItem.getIn([journal.uid, entry.uid]);
        if (cacheEntry) {
          prevUid = entry.uid;
          return cacheEntry;
        }

        const syncEntry = entry.getSyncEntry(cryptoManager, prevUid);
        prevUid = entry.uid;

        store.dispatch(setSyncInfoItem(etesync, journal.uid, syncEntry as SyncInfoItem));
        return syncEntry;
      });

      handled[journal.uid] = true;
    });

    for (const collection of syncInfoCollection.values()) {
      if (!handled[collection.uid]) {
        store.dispatch(unsetSyncInfoCollection(etesync, collection));
      }
    }
  }
);
