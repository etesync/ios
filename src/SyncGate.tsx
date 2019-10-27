import * as React from 'react';
import { useSelector } from 'react-redux';
import { Text } from 'react-native';

import { useCredentials } from './login';

import LoadingIndicator from './widgets/LoadingIndicator';

import { StoreState } from './store';

import { syncInfoSelector } from './SyncHandler';

export function useSyncGate() {
  const etesync = useCredentials()!;
  const journals = useSelector((state: StoreState) => state.cache.journals);
  const entries = useSelector((state: StoreState) => state.cache.entries);
  const userInfo = useSelector((state: StoreState) => state.cache.userInfo);
  const syncInfoCollections = useSelector((state: StoreState) => state.cache.syncInfoCollection);
  const syncInfoEntries = useSelector((state: StoreState) => state.cache.syncInfoItem);
  const syncCount = useSelector((state: StoreState) => state.syncCount);
  if (syncCount > 0) {
    return (<LoadingIndicator />);
  }

  syncInfoSelector({ etesync, entries, journals, userInfo });

  if ((userInfo === null)
    || (journals === null)
    || (entries === null)
    || (syncInfoCollections.size !== journals.size)
    || !syncInfoEntries.every((syncEntries, key) => {
      return (syncEntries && (syncEntries.size === entries.get(key)?.size));
    })
  ) {
    return (<Text>Encountered an issue while syncing. It should not happen, please inform developers.</Text>);
  }

  return null;
}
