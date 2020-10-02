// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import createSecureStore from "redux-persist-expo-securestore";
import * as SecureStore from "expo-secure-store";
import { AsyncStorage } from "react-native";
import { NetInfoStateType } from "@react-native-community/netinfo";

import { combineReducers } from "redux";
import { createMigrate, persistReducer, createTransform } from "redux-persist";

import { List, Map as ImmutableMap } from "immutable";

import * as EteSync from "etesync";
import * as Etebase from "etebase";
import {
  JournalsData, EntriesData, UserInfoData,
  CredentialsDataRemote, SettingsType,
  fetchCount, syncCount, journals, entries, credentials, userInfo, settingsReducer, encryptionKeyReducer, SyncStateJournalData, SyncStateEntryData, syncStateJournalReducer, syncStateEntryReducer, SyncInfoCollectionData, SyncInfoItemData, syncInfoCollectionReducer, syncInfoItemReducer, syncStatusReducer, lastSyncReducer, connectionReducer, permissionsReducer, errorsReducer, legacyCredentials, legacyEncryptionKeyReducer, ErrorsData,
  // Etabese stuff:
  CredentialsDataEb, SyncCollectionsData, CacheCollectionsData, SyncGeneralData, CacheItemsData,
  collections, items, syncCollections, syncGeneral, credentialsEb, DecryptedCollectionsData, DecryptedItemsData,
  decryptedCollections, decryptedItems, changeQueue, ChangeQueue, Message, messagesReducer,
} from "./reducers";

export interface StoreState {
  fetchCount: number;
  syncCount: number;
  syncStatus: string | null;
  credentials: CredentialsDataRemote;
  settings: SettingsType;
  encryptionKey: {encryptionKey: string | null};
  // Etebase {
  credentials2: CredentialsDataEb;
  sync2: {
    collections: SyncCollectionsData;
    changeQueue: ChangeQueue;
    general: SyncGeneralData;
  };
  cache2: {
    collections: CacheCollectionsData;
    items: CacheItemsData;

    decryptedCollections: DecryptedCollectionsData;
    decryptedItems: DecryptedItemsData;
  };
  // }
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
  connection: NetInfoStateType | null;
  permissions: ImmutableMap<string, boolean>;
  errors: ErrorsData;
  messages: List<Message>;

  // Legacy
  legacyCredentials: CredentialsDataRemote;
  legacyEncryptionKey: {key: string | null};
}

const secureStorage = createSecureStore({
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as any);

const settingsMigrations = {
  0: (state: any) => {
    return {
      ...state,
      ranWizrd: true,
    };
  },
  2: (state: any) => {
    return {
      ...state,
      syncCalendars: true,
    };
  },
};

const settingsPersistConfig = {
  key: "settings",
  version: 2,
  storage: AsyncStorage,
  migrate: createMigrate(settingsMigrations, { debug: false }),
};

const legacyCredentialsPersistConfig = {
  key: "credentials",
  storage: AsyncStorage,
};

const legacyEncryptionKeyPersistConfig = {
  key: "encryptionKey",
  storage: AsyncStorage,
};

const credentialsPersistConfig = {
  key: "credentials",
  storage: secureStorage,
};

const encryptionKeyPersistConfig = {
  key: "encryptionKey",
  storage: secureStorage,
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

const cacheSerialize = (state: any, key: string | number) => {
  if (key === "entries") {
    const ret = {};
    state.forEach((value: List<EteSync.Entry>, mapKey: string) => {
      ret[mapKey] = entriesSerialize(value);
    });
    return ret;
  } else if (key === "journals") {
    return journalsSerialize(state);
  } else if (key === "userInfo") {
    return userInfoSerialize(state);
  } else if ((key === "syncInfoCollection") || (key === "syncInfoItem")) {
    return state.toJS();
  }

  return state;
};

const cacheDeserialize = (state: any, key: string | number) => {
  if (key === "entries") {
    const ret = {};
    Object.keys(state).forEach((mapKey) => {
      ret[mapKey] = entriesDeserialize(state[mapKey]);
    });
    return ImmutableMap(ret);
  } else if (key === "journals") {
    return journalsDeserialize(state);
  } else if (key === "userInfo") {
    return userInfoDeserialize(state);
  } else if (key === "syncInfoCollection") {
    return ImmutableMap(state);
  } else if (key === "syncInfoItem") {
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
  key: "cache",
  version: 1,
  storage: AsyncStorage,
  transforms: [createTransform(cacheSerialize, cacheDeserialize)] as any,
  migrate: createMigrate(cacheMigrations, { debug: false }),
};

const syncSerialize = (state: any, key: string | number) => {
  if ((key === "stateJournals") || (key === "stateEntries")) {
    return state.toJS();
  }

  return state;
};

const syncDeserialize = (state: any, key: string | number) => {
  if (key === "stateJournals") {
    return ImmutableMap(state);
  } else if (key === "stateEntries") {
    return ImmutableMap(state).map((syncStateEntry: any) => {
      return ImmutableMap(syncStateEntry);
    });
  }

  return state;
};

const syncPersistConfig = {
  key: "sync",
  storage: AsyncStorage,
  transforms: [createTransform(syncSerialize, syncDeserialize)] as any,
};

const credentialsPersistConfig2 = {
  key: "credentials2",
  version: 0,
  storage: AsyncStorage,
};

const syncSerialize2 = (state: any, key: string | number) => {
  if ((key === "collections") || (key === "changeQueue")) {
    return state.toJS();
  }

  return state;
};

const syncDeserialize2 = (state: any, key: string | number) => {
  if ((key === "collections") || (key === "changeQueue")) {
    return ImmutableMap(state);
  }

  return state;
};

const syncPersistConfig2 = {
  key: "sync2",
  storage: AsyncStorage,
  transforms: [createTransform(syncSerialize2, syncDeserialize2)] as any,
};

const cacheSerialize2 = (state: any, key: string | number) => {
  if (key === "collections") {
    const typedState = state as CacheCollectionsData;
    const ret = typedState.map((x) => Etebase.toBase64(x));
    return ret.toJS();
  } else if (key === "items") {
    const typedState = state as CacheItemsData;
    const ret = typedState.map((items) => {
      return items.map((x) => Etebase.toBase64(x));
    });
    return ret.toJS();
  } else if ((key === "decryptedCollections") || (key === "decryptedItems")) {
    state.toJS();
  }

  return state;
};

const cacheDeserialize2 = (state: any, key: string | number) => {
  if (key === "collections") {
    return ImmutableMap<string, string>(state).map((x) => {
      return Etebase.fromBase64(x);
    });
  } else if (key === "items") {
    return ImmutableMap(state).map((item: any) => {
      return ImmutableMap<string, string>(item).map((x) => Etebase.fromBase64(x));
    });
  } else if (key === "decryptedCollections") {
    return ImmutableMap(state);
  } else if (key === "decryptedItems") {
    return ImmutableMap(state).map((item: any) => {
      return ImmutableMap(item);
    });
  }

  return state;
};

const cachePersistConfig2 = {
  key: "cache2",
  version: 0,
  storage: AsyncStorage,
  transforms: [createTransform(cacheSerialize2, cacheDeserialize2)] as any,
};

const reducers = combineReducers({
  fetchCount,
  syncCount,
  syncStatus: syncStatusReducer,
  settings: persistReducer(settingsPersistConfig, settingsReducer),
  credentials: persistReducer(credentialsPersistConfig, credentials),
  encryptionKey: persistReducer(encryptionKeyPersistConfig, encryptionKeyReducer),
  // Etebase {
  credentials2: persistReducer(credentialsPersistConfig2, credentialsEb),
  sync2: persistReducer(syncPersistConfig2, combineReducers({
    collections: syncCollections,
    changeQueue,
    general: syncGeneral,
  })),
  cache2: persistReducer(cachePersistConfig2, combineReducers({
    collections,
    items,

    decryptedCollections,
    decryptedItems,
  })),
  // }
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
  messages: messagesReducer,

  // Legacy
  legacyCredentials: persistReducer(legacyCredentialsPersistConfig, legacyCredentials),
  legacyEncryptionKey: persistReducer(legacyEncryptionKeyPersistConfig, legacyEncryptionKeyReducer),
});

export default reducers;
