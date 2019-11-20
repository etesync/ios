import { Action, createAction } from 'redux-actions';

import * as EteSync from 'etesync';
import { UserInfo } from 'etesync';

import { CredentialsData, CredentialsDataRemote, EntriesData, SettingsType, SyncStateJournal, SyncStateEntry, SyncInfoItem } from './';

export const fetchCredentials = createAction(
  'FETCH_CREDENTIALS',
  (username: string, password: string, server: string) => {
    const authenticator = new EteSync.Authenticator(server);

    return new Promise((resolve, reject) => {
      authenticator.getAuthToken(username, password).then(
        (authToken) => {
          const creds = new EteSync.Credentials(username, authToken);

          const context = {
            serviceApiUrl: server,
            credentials: creds,
          };

          resolve(context);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }
);

export const logout = createAction(
  'LOGOUT',
  () => undefined
);

export const deriveKey = createAction(
  'DERIVE_KEY',
  (username: string, encryptionPassword: string) => {
    return EteSync.deriveKey(username, encryptionPassword);
  }
);

export const resetKey = createAction(
  'RESET_KEY',
  () => {
    return null;
  }
);

export const login = (username: string, password: string, encryptionPassword: string, server: string) => {
  return async (dispatch: any) => {
    await dispatch(fetchCredentials(username, password, server));
    await dispatch(deriveKey(username, encryptionPassword));
  };
};

export const fetchListJournal = createAction(
  'FETCH_LIST_JOURNAL',
  (etesync: CredentialsData) => {
    const creds = etesync.credentials;
    const apiBase = etesync.serviceApiUrl;
    const journalManager = new EteSync.JournalManager(creds, apiBase);

    return journalManager.list();
  }
);

export const addJournal = createAction(
  'ADD_JOURNAL',
  (etesync: CredentialsData, journal: EteSync.Journal) => {
    const creds = etesync.credentials;
    const apiBase = etesync.serviceApiUrl;
    const journalManager = new EteSync.JournalManager(creds, apiBase);

    return journalManager.create(journal);
  },
  (_etesync: CredentialsData, journal: EteSync.Journal) => {
    return { item: journal };
  }
);

export const updateJournal = createAction(
  'UPDATE_JOURNAL',
  (etesync: CredentialsData, journal: EteSync.Journal) => {
    const creds = etesync.credentials;
    const apiBase = etesync.serviceApiUrl;
    const journalManager = new EteSync.JournalManager(creds, apiBase);

    return journalManager.update(journal);
  },
  (_etesync: CredentialsData, journal: EteSync.Journal) => {
    return { item: journal };
  }
);

export const deleteJournal = createAction(
  'DELETE_JOURNAL',
  (etesync: CredentialsData, journal: EteSync.Journal) => {
    const creds = etesync.credentials;
    const apiBase = etesync.serviceApiUrl;
    const journalManager = new EteSync.JournalManager(creds, apiBase);

    return journalManager.delete(journal);
  },
  (_etesync: CredentialsData, journal: EteSync.Journal) => {
    return { item: journal };
  }
);

export const fetchEntries = createAction(
  'FETCH_ENTRIES',
  (etesync: CredentialsData, journalUid: string, prevUid: string | null) => {
    const creds = etesync.credentials;
    const apiBase = etesync.serviceApiUrl;
    const entryManager = new EteSync.EntryManager(creds, apiBase, journalUid);

    return entryManager.list(prevUid);
  },
  (_etesync: CredentialsData, journalUid: string, prevUid: string | null) => {
    return { journal: journalUid, prevUid };
  }
);

export const addEntries = createAction(
  'ADD_ENTRIES',
  async (etesync: CredentialsData, journalUid: string, newEntries: EteSync.Entry[], prevUid: string | null) => {
    const creds = etesync.credentials;
    const apiBase = etesync.serviceApiUrl;
    const entryManager = new EteSync.EntryManager(creds, apiBase, journalUid);

    await entryManager.create(newEntries, prevUid);
    return newEntries;
  },
  (_etesync: CredentialsData, journalUid: string, newEntries: EteSync.Entry[], prevUid: string | null) => {
    return { journal: journalUid, entries: newEntries, prevUid };
  }
);

export const fetchUserInfo = createAction(
  'FETCH_USER_INFO',
  (etesync: CredentialsDataRemote, owner: string) => {
    const creds = etesync.credentials;
    const apiBase = etesync.serviceApiUrl;
    const userInfoManager = new EteSync.UserInfoManager(creds, apiBase);

    return userInfoManager.fetch(owner);
  }
);

export const createUserInfo = createAction(
  'CREATE_USER_INFO',
  (etesync: CredentialsData, userInfo: UserInfo) => {
    const creds = etesync.credentials;
    const apiBase = etesync.serviceApiUrl;
    const userInfoManager = new EteSync.UserInfoManager(creds, apiBase);

    return userInfoManager.create(userInfo);
  },
  (_etesync: CredentialsData, userInfo: UserInfo) => {
    return { userInfo };
  }
);

export const updateUserInfo = createAction(
  'UPDATE_USER_INFO',
  (etesync: CredentialsData, userInfo: UserInfo) => {
    const creds = etesync.credentials;
    const apiBase = etesync.serviceApiUrl;
    const userInfoManager = new EteSync.UserInfoManager(creds, apiBase);

    return userInfoManager.update(userInfo);
  },
  (_etesync: CredentialsData, userInfo: UserInfo) => {
    return { userInfo };
  }
);

export const performSync = createAction(
  'PERFORM_SYNC',
  (syncPromise: Promise<any>) => {
    return syncPromise;
  }
);

export const setSyncStateJournal = createAction(
  'SET_SYNC_STATE_JOURNAL',
  (_etesync: CredentialsData, syncStateJournal: SyncStateJournal) => {
    return { ...syncStateJournal };
  }
);

export const unsetSyncStateJournal = createAction(
  'UNSET_SYNC_STATE_JOURNAL',
  (_etesync: CredentialsData, syncStateJournal: SyncStateJournal) => {
    return { ...syncStateJournal };
  }
);

export const setSyncStateEntry = createAction(
  'SET_SYNC_STATE_ENTRY',
  (_etesync: CredentialsData, _journalUid: string, syncStateEntry: SyncStateEntry) => {
    return { ...syncStateEntry };
  },
  (_etesync: CredentialsData, journalUid: string, _syncStateEntry: SyncStateEntry) => {
    return journalUid;
  }
);

export const unsetSyncStateEntry = createAction(
  'UNSET_SYNC_STATE_ENTRY',
  (_etesync: CredentialsData, _journalUid: string, syncStateEntry: SyncStateEntry) => {
    return { ...syncStateEntry };
  },
  (_etesync: CredentialsData, journalUid: string, _syncStateEntry: SyncStateEntry) => {
    return journalUid;
  }
);


export const setSyncInfoCollection = createAction(
  'SET_SYNC_INFO_COLLECTION',
  (_etesync: CredentialsData, syncInfoCollection: EteSync.CollectionInfo) => {
    return { ...syncInfoCollection };
  }
);

export const unsetSyncInfoCollection = createAction(
  'UNSET_SYNC_INFO_COLLECTION',
  (_etesync: CredentialsData, syncInfoCollection: EteSync.CollectionInfo) => {
    return { ...syncInfoCollection };
  }
);


export const setSyncInfoItem = createAction(
  'SET_SYNC_INFO_ITEM',
  (_etesync: CredentialsData, _journalUid: string, syncInfoItem: SyncInfoItem) => {
    return { ...syncInfoItem };
  },
  (_etesync: CredentialsData, journalUid: string, _syncInfoItem: SyncInfoItem) => {
    return journalUid;
  }
);

export const unsetSyncInfoItem = createAction(
  'UNSET_SYNC_INFO_ITEM',
  (_etesync: CredentialsData, _journalUid: string, syncInfoItem: SyncInfoItem) => {
    return { ...syncInfoItem };
  },
  (_etesync: CredentialsData, journalUid: string, _syncInfoItem: SyncInfoItem) => {
    return journalUid;
  }
);

export const clearErros = createAction(
  'CLEAR_ERRORS',
  (_etesync: CredentialsData) => {
    return true;
  }
);

export function fetchJournalEntries(etesync: CredentialsData, currentEntries: EntriesData, journal: EteSync.Journal) {
  return (dispatch: any) => {
    let prevUid: string | null = null;
    const entries = currentEntries.get(journal.uid);
    if (entries && entries) {
      const last = entries.last() as EteSync.Entry;
      prevUid = last?.uid ?? null;
    }

    return dispatch(fetchEntries(etesync, journal.uid, prevUid));
  };
}


export function fetchAll(etesync: CredentialsData, currentEntries: EntriesData) {
  return (dispatch: any) => {
    return new Promise<boolean>((resolve, reject) => {
      dispatch(fetchListJournal(etesync)).then((journalsAction: Action<EteSync.Journal[]>) => {
        const journals = journalsAction.payload;
        if (!journals || (journals.length === 0)) {
          resolve(false);
        }

        Promise.all(journals.map((journal) => (
          dispatch(fetchJournalEntries(etesync, currentEntries, journal))
        ))).then(() => resolve(true)).catch(reject);
      }).catch(reject);
    });
  };
}

// FIXME: Move the rest to their own file
export const setSettings = createAction(
  'SET_SETTINGS',
  (settings: SettingsType) => {
    return { ...settings };
  }
);
