import * as React from 'react';
import { useSelector } from 'react-redux';

import 'moment/locale/en-gb';

import { List, Map } from 'immutable';
import { createSelector } from 'reselect';

import * as EteSync from './api/EteSync';
import { byte } from './api/Helpers';

import { JournalsType, EntriesType, StoreState, CredentialsData, UserInfoType } from './store';

import { useCredentials } from './login';

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
  journals: JournalsType;
  entries: EntriesType;
  userInfo: UserInfoType;
}

export const syncInfoSelector = createSelector(
  (props: SyncInfoSelectorProps) => props.etesync,
  (props: SyncInfoSelectorProps) => props.journals.value!,
  (props: SyncInfoSelectorProps) => props.entries,
  (props: SyncInfoSelectorProps) => props.userInfo.value!,
  (etesync, journals, entries, userInfo) => {
    const derived = etesync.encryptionKey;
    let asymmetricCryptoManager: EteSync.AsymmetricCryptoManager;
    try {
      const userInfoCryptoManager = new EteSync.CryptoManager(etesync.encryptionKey, 'userInfo');
      userInfo.verify(userInfoCryptoManager);
    } catch (error) {
      if (error instanceof EteSync.IntegrityError) {
        throw new EteSync.EncryptionPasswordError(error.message);
      } else {
        throw error;
      }
    }

    return journals.reduce(
      (ret, journal) => {
        const journalEntries = entries.get(journal.uid);
        let prevUid: string | null = null;

        if (!journalEntries || !journalEntries.value) {
          return ret;
        }

        let cryptoManager: EteSync.CryptoManager;
        let derivedJournalKey: byte[];
        if (journal.key) {
          if (!asymmetricCryptoManager) {
            const keyPair = userInfo.getKeyPair(new EteSync.CryptoManager(derived, 'userInfo', userInfo.version));
            asymmetricCryptoManager = new EteSync.AsymmetricCryptoManager(keyPair);
          }
          derivedJournalKey = asymmetricCryptoManager.decryptBytes(journal.key);
          cryptoManager = EteSync.CryptoManager.fromDerivedKey(derivedJournalKey, journal.version);
        } else {
          cryptoManager = new EteSync.CryptoManager(derived, journal.uid, journal.version);
        }

        const collectionInfo = journal.getInfo(cryptoManager);

        const syncEntries = journalEntries.value.map((entry: EteSync.Entry) => {
          const syncEntry = entry.getSyncEntry(cryptoManager, prevUid);
          prevUid = entry.uid;

          return syncEntry;
        });

        return ret.set(journal.uid, {
          entries: syncEntries,
          collection: collectionInfo,
          journal,
          derivedJournalKey,
          journalEntries: journalEntries.value,
        });
      },
      Map<string, SyncInfoJournal>()
    );
  }
);

export function useSyncInfo() {
  const etesync = useCredentials().value;

  const { journals, entries, userInfo } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
      entries: state.cache.entries,
      userInfo: state.cache.userInfo,
    })
  );

  return React.useMemo(() => {
    if ((entries !== null) && (entries.size > 0) && entries.every((x) => (x.value !== null))) {
      return syncInfoSelector({ etesync, journals, entries, userInfo });
    } else {
      return null;
    }
  }, [etesync, journals, entries, userInfo]);
}
