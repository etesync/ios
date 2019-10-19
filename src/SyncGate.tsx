import * as React from 'react';
import { useSelector } from 'react-redux';

import 'moment/locale/en-gb';

import LoadingIndicator from './widgets/LoadingIndicator';

import { StoreState } from './store';

import { useSyncInfo } from './SyncHandler';
export * from './SyncHandler'; // FIXME: Should be granular

export function useSyncGate() {
  const syncInfo = useSyncInfo();
  const { userInfo, journals } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
      entries: state.cache.entries,
      userInfo: state.cache.userInfo,
    })
  );

  if ((userInfo === null) || (journals === null) || (syncInfo === null) || (syncInfo.size === 0)) {
    return (<LoadingIndicator />);
  }

  return null;
}
