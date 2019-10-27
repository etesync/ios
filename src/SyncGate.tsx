import * as React from 'react';
import { useSelector } from 'react-redux';
import { Text } from 'react-native';

import LoadingIndicator from './widgets/LoadingIndicator';

import { StoreState } from './store';

export * from './SyncHandler'; // FIXME: Should be granular

export function useSyncGate() {
  const journals = useSelector((state: StoreState) => state.cache.journals);
  const entries = useSelector((state: StoreState) => state.cache.entries);
  const userInfo = useSelector((state: StoreState) => state.cache.userInfo);
  const syncInfoCollections = useSelector((state: StoreState) => state.cache.syncInfoCollection);
  const syncInfoEntries = useSelector((state: StoreState) => state.cache.syncInfoItem);
  const fetchCount = useSelector((state: StoreState) => state.fetchCount);

  if ((userInfo === null)
    || (journals === null)
    || (entries === null)
    || (syncInfoCollections.size !== journals.size)
    || !syncInfoEntries.every((syncEntries, key) => {
      return (syncEntries && (syncEntries.size === entries.get(key)?.size));
    })
  ) {
    if (fetchCount > 0) {
      return (<LoadingIndicator />);
    } else {
      return (<Text>No data found. Should not happen...</Text>);
    }
  }

  return null;
}
