import * as React from 'react';
import { useSelector } from 'react-redux';
import { Text } from 'react-native';

import 'moment/locale/en-gb';

import LoadingIndicator from './widgets/LoadingIndicator';

import { StoreState } from './store';

import { useSyncInfo } from './SyncHandler';
export * from './SyncHandler'; // FIXME: Should be granular

export function useSyncGate() {
  const syncInfo = useSyncInfo();
  const { userInfo, journals, fetchCount } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
      entries: state.cache.entries,
      userInfo: state.cache.userInfo,
      fetchCount: state.fetchCount,
    })
  );

  if ((userInfo === null) || (journals === null) || (syncInfo === null) || (syncInfo.size === 0)) {
    if (fetchCount > 0) {
      return (<LoadingIndicator />);
    } else {
      return (<Text>No data found. Should not happen...</Text>);
    }
  }

  return null;
}
