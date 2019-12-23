import { AsyncStorage, ConnectionType } from 'react-native';

import { combineReducers } from 'redux';
import { createMigrate, persistReducer, createTransform } from 'redux-persist';

import { List, Map as ImmutableMap } from 'immutable';

import * as EteSync from 'etesync';
import {
  JournalsData, EntriesData, UserInfoData,
  CredentialsDataRemote, SettingsType,
  fetchCount, syncCount, journals, entries, credentials, userInfo, settingsReducer, encryptionKeyReducer, SyncStateJournalData, SyncStateEntryData, syncStateJournalReducer, syncStateEntryReducer, SyncInfoCollectionData, SyncInfoItemData, syncInfoCollectionReducer, syncInfoItemReducer, syncStatusReducer, lastSyncReducer, connectionReducer, permissionsReducer, errorsReducer,
} from './reducers';

export interface StoreState {
  fetchCount: number;
  syncCount: number;
  syncStatus: string | null;
  credentials: CredentialsDataRemote;
  settings: SettingsType;
  encryptionKey: {key: string};
  sync: {
    stateJournals: SyncStateJournalData;
    stateEntries: SyncStateEntryData;
    lastSync: Date | null;
  };
  cache: {
    journals: JournalsData;
    entries: EntriesData;
    userInfo: UserInfoData;

    syncInfoCollection: SyncInfoCollectionData;
    syncInfoItem: SyncInfoItemData;
  };
  connection: ConnectionType | null;
  permissions: ImmutableMap<string, boolean>;
  errors: List<Error>;
}

const settingsPersistConfig = {
  key: 'settings',
  storage: AsyncStorage,
};

const credentialsPersistConfig = {
  key: 'credentials',
  storage: AsyncStorage,
};

const encryptionKeyPersistConfig = {
  key: 'encryptionKey',
  storage: AsyncStorage,
};

const journalsSerialize = (state: JournalsData) => {
  if (state === null) {
    return null;
  }

  return state.map((x, _uid) => x.serialize()).toJS();
};

const journalsDeserialize = (state: []) => {
  if (state === null) {
    return null;
  }

  const newState = ImmutableMap<string, EteSync.Journal>().asMutable();
  Object.keys(state).forEach((uid) => {
    const x = state[uid];
    const ret = new EteSync.Journal({ uid }, x.version);
    ret.deserialize(x);
    newState.set(uid, ret);
  });
  return newState.asImmutable();
};

const entriesSerialize = (state: List<EteSync.Entry>) => {
  if (state === null) {
    return null;
  }

  return state.map((x) => x.serialize()).toJS();
};

const entriesDeserialize = (state: EteSync.EntryJson[]): List<EteSync.Entry> | null => {
  if (state === null) {
    return null;
  }

  return List(state.map((x) => {
    const ret = new EteSync.Entry();
    ret.deserialize(x);
    return ret;
  }));
};

const userInfoSerialize = (state: UserInfoData) => {
  if (state === null) {
    return null;
  }

  return state.serialize();
};

const userInfoDeserialize = (state: EteSync.UserInfoJson) => {
  if (state === null) {
    return null;
  }

  const ret = new EteSync.UserInfo(state.owner!, state.version);
  ret.deserialize(state);
  return ret;
};

const cacheSerialize = (state: any, key: string) => {
  if (key === 'entries') {
    const ret = {};
    state.forEach((value: List<EteSync.Entry>, mapKey: string) => {
      ret[mapKey] = entriesSerialize(value);
    });
    return ret;
  } else if (key === 'journals') {
    return journalsSerialize(state);
  } else if (key === 'userInfo') {
    return userInfoSerialize(state);
  } else if ((key === 'syncInfoCollection') || (key === 'syncInfoItem')) {
    return state.toJS();
  }

  return state;
};

const cacheDeserialize = (state: any, key: string) => {
  if (key === 'entries') {
    const ret = {};
    Object.keys(state).forEach((mapKey) => {
      ret[mapKey] = entriesDeserialize(state[mapKey]);
    });
    return ImmutableMap(ret);
  } else if (key === 'journals') {
    return journalsDeserialize(state);
  } else if (key === 'userInfo') {
    return userInfoDeserialize(state);
  } else if (key === 'syncInfoCollection') {
    return ImmutableMap(state);
  } else if (key === 'syncInfoItem') {
    return ImmutableMap(state).map((syncStateEntry: any) => {
      return ImmutableMap(syncStateEntry);
    });
  }

  return state;
};

const cacheMigrations = {
  0: (state: any) => {
    return {
      ...state,
      journals: undefined,
    };
  },
};

const cachePersistConfig = {
  key: 'cache',
  version: 1,
  storage: AsyncStorage,
  transforms: [createTransform(cacheSerialize, cacheDeserialize)],
  migrate: createMigrate(cacheMigrations, { debug: false }),
};

const syncSerialize = (state: any, key: string) => {
  if ((key === 'stateJournals') || (key === 'stateEntries')) {
    return state.toJS();
  }

  return state;
};

const syncDeserialize = (state: any, key: string) => {
  if (key === 'stateJournals') {
    return ImmutableMap(state);
  } else if (key === 'stateEntries') {
    return ImmutableMap(state).map((syncStateEntry: any) => {
      return ImmutableMap(syncStateEntry);
    });
  }

  return state;
};

const syncPersistConfig = {
  key: 'sync',
  storage: AsyncStorage,
  transforms: [createTransform(syncSerialize, syncDeserialize)],
};

const reducers = combineReducers({
  fetchCount,
  syncCount,
  syncStatus: syncStatusReducer,
  settings: persistReducer(settingsPersistConfig, settingsReducer),
  credentials: persistReducer(credentialsPersistConfig, credentials),
  encryptionKey: persistReducer(encryptionKeyPersistConfig, encryptionKeyReducer),
  sync: persistReducer(syncPersistConfig, combineReducers({
    stateJournals: syncStateJournalReducer,
    stateEntries: syncStateEntryReducer,
    lastSync: lastSyncReducer,
  })),
  cache: persistReducer(cachePersistConfig, combineReducers({
    entries,
    journals,
    userInfo,

    syncInfoCollection: syncInfoCollectionReducer,
    syncInfoItem: syncInfoItemReducer,
  })),
  connection: connectionReducer,
  permissions: permissionsReducer,
  errors: errorsReducer,
});

export default reducers;
