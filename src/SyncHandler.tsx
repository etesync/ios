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
    const keyPair = userInfo.getKeyPair(new EteSync.CryptoManager(derived, 'userInfo', userInfo.version));
    asymmetricCryptoManager = new EteSync.AsymmetricCryptoManager(keyPair);

    return journals.reduce(
      async (promiseRet, journal) => {
        const ret = await promiseRet;
        const journalEntries = entries.get(journal.uid);
        let prevUid: string | null = null;

        if (!journalEntries || !journalEntries.value) {
          return Promise.resolve(ret);
        }

        let cryptoManager: EteSync.CryptoManager;
        let derivedJournalKey: byte[];
        if (journal.key) {
          derivedJournalKey = await asymmetricCryptoManager.decryptBytes(journal.key);
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

        return Promise.resolve(ret.set(journal.uid, {
          entries: syncEntries,
          collection: collectionInfo,
          journal,
          derivedJournalKey,
          journalEntries: journalEntries.value,
        }));
      },
      Promise.resolve(Map<string, SyncInfoJournal>())
    );
  }
);

export function useSyncInfo() {
  const [syncInfo, setSyncInfo] = React.useState(null as SyncInfo);
  const etesync = useCredentials().value;

  const selectorParams = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
      entries: state.cache.entries,
      userInfo: state.cache.userInfo,
    })
  );
  const entries = selectorParams.entries;

  React.useEffect(() => {
    if ((entries !== null) && (entries.size > 0) && entries.every((x) => (x.value !== null))) {
      // FIXME: Hack to make this async. Shouldn't need the timer.
      const timeout = setTimeout(() => {
        syncInfoSelector({ etesync, ...selectorParams }).then((newSyncInfo) => {
          setSyncInfo(newSyncInfo);
        });
      }, 10);

      return function cleanup() {
        clearTimeout(timeout);
      };
    }

    return undefined;
  });

  return syncInfo;
}
