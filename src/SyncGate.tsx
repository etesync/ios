import * as React from 'react';
import { useSelector } from 'react-redux';
import { Text } from 'react-native';

import 'moment/locale/en-gb';

import LoadingIndicator from './widgets/LoadingIndicator';

import { StoreState } from './store';

export * from './SyncHandler'; // FIXME: Should be granular

export function useSyncGate() {
  const { userInfo, journals, entries, syncInfoCollections, syncInfoEntries, fetchCount } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
      entries: state.cache.entries,
      userInfo: state.cache.userInfo,
      syncInfoCollections: state.cache.syncInfoCollection,
      syncInfoEntries: state.cache.syncInfoItem,
      fetchCount: state.fetchCount,
    })
  );

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
