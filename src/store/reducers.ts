import { Action, ActionMeta, ActionFunctionAny, combineActions, handleAction, handleActions } from 'redux-actions';
import { shallowEqual } from 'react-redux';

import { List, Map as ImmutableMap } from 'immutable';

import * as EteSync from 'etesync';

import * as actions from './actions';
import { LogLevel } from '../logging';

export interface CredentialsDataRemote {
  serviceApiUrl: string;
  credentials: EteSync.Credentials;
}

export interface CredentialsData extends CredentialsDataRemote {
  encryptionKey: string;
}

interface BaseModel {
  uid: string;
}

export type JournalsData = ImmutableMap<string, EteSync.Journal>;

export type EntriesData = ImmutableMap<string, List<EteSync.Entry>>;

export type UserInfoData = EteSync.UserInfo;


export interface SyncStateJournal extends BaseModel {
  localId: string; // The id of the local collection (e.g. Calendar or Address Book)
  lastSyncUid: string | null; // The last entry processed (different from the last entry saved)
}
export type SyncStateJournalData = ImmutableMap<string, SyncStateJournal>;

export interface SyncStateEntry extends BaseModel {
  localId: string; // The id of the local entry
  lastHash: string; // The hash of the entry as it was when last processed
}
export type SyncStateJournalEntryData = ImmutableMap<string, SyncStateEntry>;
export type SyncStateEntryData = ImmutableMap<string, SyncStateJournalEntryData>;


export type SyncInfoItem = EteSync.SyncEntry & BaseModel;
export type SyncInfoItemData = ImmutableMap<string, ImmutableMap<string, SyncInfoItem>>;
export type SyncInfoCollectionData = ImmutableMap<string, EteSync.CollectionInfo>;


export const encryptionKeyReducer = handleActions(
  {
    [actions.deriveKey.toString()]: (state: {key: string | null}, action: any) => {
      if (action.error) {
        return state;
      } else if (action.payload === undefined) {
        return state;
      }

      return { key: action.payload };
    },
    [actions.resetKey.toString()]: (_state: {key: string | null}, _action: any) => (
      { key: null }
    ),
    [actions.logout.toString()]: (_state: {key: string | null}, _action: any) => {
      return { key: null };
    },
  },
  { key: null }
);

export const credentials = handleActions(
  {
    [actions.fetchCredentials.toString()]: (
      state: CredentialsDataRemote, action: any) => {
      if (action.error) {
        return state;
      } else if (action.payload === undefined) {
        return state;
      } else {
        const {
          encryptionKey, // We don't want to set encryption key here.
          ...payload
        } = action.payload;
        return payload;
      }
    },
    [actions.logout.toString()]: (_state: CredentialsDataRemote, _action: any) => {
      return {};
    },
  },
  {} as CredentialsDataRemote
);

function entriesListSetExtend(
  state: List<any> | undefined, action: Action<EteSync.Entry[]>, extend = false) {
  state = state ?? List([]);

  if (action.error) {
    return state;
  } else {
    const payload = action.payload ?? null;

    if (!payload) {
      return state;
    }

    if (extend && (state !== null)) {
      if (payload !== null) {
        state = state.concat(payload);
      }
    } else if (payload !== null) {
      state = List(payload);
    }
    return state;
  }
}

function fetchCreateEntriesReducer(state: EntriesData, action: any) {
  const prevState = state.get(action.meta.journal);
  const extend = action.meta.prevUid !== null;
  return state.set(action.meta.journal,
    entriesListSetExtend(prevState, action, extend));
}

export const entries = handleActions(
  {
    [actions.fetchEntries.toString()]: fetchCreateEntriesReducer,
    [actions.addEntries.toString()]: fetchCreateEntriesReducer,
    [actions.addJournal.toString()]: (state: EntriesData, action: any) => {
      const journal = action.meta.item.uid;
      return state.set(journal, List([]));
    },
    [actions.logout.toString()]: (state: EntriesData, _action: any) => {
      return state.clear();
    },
  },
  ImmutableMap({})
);

const setMapModelReducer = (state: JournalsData, action: Action<EteSync.Journal[]>) => {
  if (action.error || !action.payload) {
    return state;
  }

  state = state ?? ImmutableMap<string, EteSync.Journal>().asMutable();
  const old = state.asMutable();

  return state.withMutations((ret) => {
    const items = action.payload;
    for (const item of items) {
      const current = old.get(item.uid);
      if (!current || !shallowEqual(current.serialize(), item.serialize())) {
        ret.set(item.uid, item);
      }

      if (current) {
        old.delete(item.uid);
      }
    }

    // Delete all the items that were deleted remotely (not handled above).
    for (const uid of old.keys()) {
      ret.delete(uid);
    }
  });
};

const addEditMapModelReducer = (state: JournalsData, action: ActionMeta<EteSync.Journal, { item: EteSync.Journal }>) => {
  if (action.error) {
    return state;
  } else {
    let payload = (action.payload === undefined) ? null : action.payload;
    payload = (action.meta === undefined) ? payload : action.meta.item;

    if (!payload) {
      return state;
    }

    const item = payload;
    return state.set(item.uid, item);
  }
};

const deleteMapModelReducer = (state: JournalsData, action: ActionMeta<EteSync.Journal, { item: EteSync.Journal }>) => {
  if (action.error) {
    return state;
  } else {
    let payload = (action.payload === undefined) ? null : action.payload;
    payload = (action.meta === undefined) ? payload : action.meta.item;

    if (!payload) {
      return state;
    }

    const uid = payload.uid;
    return state.delete(uid);
  }
};

export const journals = handleActions(
  {
    [actions.fetchListJournal.toString()]: setMapModelReducer as any,
    [actions.addJournal.toString()]: addEditMapModelReducer,
    [actions.updateJournal.toString()]: addEditMapModelReducer,
    [actions.deleteJournal.toString()]: deleteMapModelReducer,
    [actions.logout.toString()]: (state: JournalsData, _action: any) => {
      return state.clear();
    },
  },
  ImmutableMap({})
);

export const userInfo = handleActions(
  {
    [combineActions(
      actions.fetchUserInfo,
      actions.createUserInfo,
      actions.updateUserInfo
    ).toString()]: (state: UserInfoData | null, action: any) => {
      if (action.error) {
        return state;
      } else {
        let payload = action.payload ?? null;

        if (payload === null) {
          return state;
        }

        payload = action.meta?.userInfo ?? payload;

        if (!state || !shallowEqual(state.serialize(), payload.serialize())) {
          return payload;
        }

        return state;
      }
    },
    [actions.logout.toString()]: (_state: any, _action: any) => {
      return null;
    },
  },
  null
);

function simpleMapReducer<TypeData extends ImmutableMap<string, TypeItem>, TypeItem extends BaseModel>(suffix: string) {
  const _actions: {[key: string]: string} = actions as any;
  return {
    [_actions['set' + suffix].toString()]: (state: TypeData, action: Action<TypeItem>) => {
      const syncStateJournal = action.payload;
      const current = state.get(syncStateJournal.uid);
      if (!current || !shallowEqual(current, syncStateJournal)) {
        return state.set(syncStateJournal.uid, syncStateJournal);
      }

      return state;
    },
    [_actions['unset' + suffix].toString()]: (state: TypeData, action: Action<TypeItem>) => {
      const syncStateJournal = action.payload;
      return state.remove(syncStateJournal.uid);
    },
    [actions.logout.toString()]: (state: TypeData, _action: any) => {
      return state.clear();
    },
  };
}

function simpleMapMapReducer<TypeData extends ImmutableMap<string, ImmutableMap<string, TypeItem>>, TypeItem extends BaseModel>(suffix: string) {
  const _actions: {[key: string]: string} = actions as any;
  return {
    [_actions['set' + suffix].toString()]: (state: TypeData, action: Action<TypeItem>) => {
      const syncStateEntry = action.payload;
      const mainKey = (action as any).meta as string;
      if (!state.has(mainKey)) {
        state.set(mainKey, ImmutableMap({}));
      }
      return state.setIn([mainKey, syncStateEntry.uid], syncStateEntry);
    },
    [_actions['unset' + suffix].toString()]: (state: TypeData, action: Action<TypeItem>) => {
      const syncStateEntry = action.payload;
      const mainKey = (action as any).meta as string;
      return state.deleteIn([mainKey, syncStateEntry.uid]);
    },
    [actions.logout.toString()]: (state: TypeData, _action: any) => {
      return state.clear();
    },
  };
}


export const syncStateJournalReducer = handleActions(
  {
    ...simpleMapReducer<SyncStateJournalData, SyncStateJournal>('SyncStateJournal'),
  },
  ImmutableMap({})
);

export const syncStateEntryReducer = handleActions(
  {
    ...simpleMapMapReducer<SyncStateEntryData, SyncStateEntry>('SyncStateEntry'),
    [actions.setSyncStateJournal.toString()]: (state: SyncStateEntryData, _action: Action<any>) => {
      const action: Action<SyncStateJournal> = _action; // Required because for some reason the typing fails if not the case.
      const syncStateJournal = action.payload;
      if (!state.has(syncStateJournal.uid)) {
        return state.set(syncStateJournal.uid, ImmutableMap({}));
      } else {
        return state;
      }
    },
    [actions.unsetSyncStateJournal.toString()]: (state: SyncStateEntryData, _action: Action<any>) => {
      const action: Action<SyncStateJournal> = _action; // Required because for some reason the typing fails if not the case.
      const syncStateJournal = action.payload;
      return state.remove(syncStateJournal.uid);
    },
  },
  ImmutableMap({})
);


export const syncInfoCollectionReducer = handleActions(
  {
    ...simpleMapReducer<SyncInfoCollectionData, EteSync.CollectionInfo>('SyncInfoCollection'),
  },
  ImmutableMap({})
);

export const syncInfoItemReducer = handleActions(
  {
    ...simpleMapMapReducer<SyncInfoItemData, SyncInfoItem>('SyncInfoItem'),
    [actions.unsetSyncInfoCollection.toString()]: (state: SyncInfoItemData, _action: Action<any>) => {
      const action: Action<EteSync.CollectionInfo> = _action; // Required because for some reason the typing fails if not the case.
      const syncStateJournal = action.payload;
      return state.remove(syncStateJournal.uid);
    },
  },
  ImmutableMap({})
);

const fetchActions = [
] as Array<ActionFunctionAny<Action<any>>>;

for (const func in actions) {
  if (func.startsWith('fetch') ||
    func.startsWith('add') ||
    func.startsWith('update') ||
    func.startsWith('delete')) {

    fetchActions.push((actions as any)[func.toString()]);
  }
}

// Indicates network activity, not just fetch
export const fetchCount = handleAction(
  combineActions(
    ...fetchActions
  ),
  (state: number, action: any) => {
    if (action.payload === undefined) {
      return state + 1;
    } else {
      return state - 1;
    }
  },
  0
);

export const errorsReducer = handleActions(
  {
    [combineActions(actions.performSync).toString()]: (state: List<Error>, action: Action<any>) => {
      if (action.error) {
        return state.push(action.payload);
      }

      return state;
    },
    [actions.clearErros.toString()]: (state: List<Error>, _action: Action<any>) => {
      return state.clear();
    },
    [actions.logout.toString()]: (state: List<Error>, _action: any) => {
      return state.clear();
    },
  },
  List([])
);

export interface ConnectionInfo {
  type: string;
  isConnected: boolean;
}

export const connectionReducer = handleActions(
  {
    [actions.setConnectionInfo.toString()]: (_state: ConnectionInfo | null, action: Action<ConnectionInfo>) => {
      return action.payload;
    },
  },
  null
);

export const permissionsReducer = handleActions(
  {
    [actions.setPermission.toString()]: (state: ImmutableMap<string, boolean>, action: ActionMeta<boolean, string>) => {
      return state.set(action.meta, action.payload);
    },
  },
  ImmutableMap({})
);

export const syncStatusReducer = handleActions(
  {
    [actions.setSyncStatus.toString()]: (_state: string | null, action: Action<string | null>) => {
      return action.payload;
    },
    [actions.performSync.toString()]: (_state: string | null, _action: Action<any>) => {
      if (_action.payload === undefined) {
        return 'Started sync';
      }
      return null;
    },
  },
  null
);

export const lastSyncReducer = handleActions(
  {
    [actions.performSync.toString()]: (state: Date | null, action: Action<boolean | undefined>) => {
      if (action.payload) {
        return new Date();
      }
      return state;
    },
    [actions.logout.toString()]: (_state: Date | null, _action: any) => {
      return null;
    },
  },
  null
);

export const syncCount = handleAction(
  actions.performSync,
  (state: number, action: any) => {
    if (action.payload === undefined) {
      return state + 1;
    } else {
      return state - 1;
    }
  },
  0
);

// FIXME Move all the below (potentially the fetchCount ones too) to their own file
export interface SettingsType {
  locale: string;
  logLevel: LogLevel;
  syncContacts: boolean;
}

export const settingsReducer = handleActions(
  {
    [actions.setSettings.toString()]: (state: SettingsType, action: any) => (
      { ...state, ...action.payload }
    ),
  },
  { locale: 'en-gb', logLevel: LogLevel.Off, syncContacts: false }
);
