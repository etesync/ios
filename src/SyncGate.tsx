import * as React from 'react';
import { useSelector } from 'react-redux';

import { useCredentials } from './login';

import LoadingIndicator from './widgets/LoadingIndicator';

import { StoreState } from './store';

import { syncInfoSelector } from './SyncHandler';

export function useSyncGate() {
  const etesync = useCredentials();
  const journals = useSelector((state: StoreState) => state.cache.journals);
  const entries = useSelector((state: StoreState) => state.cache.entries);
  const userInfo = useSelector((state: StoreState) => state.cache.userInfo);
  const syncCount = useSelector((state: StoreState) => state.syncCount);

  if ((syncCount > 0) || !etesync || !journals || !entries || !userInfo) {
    return (<LoadingIndicator />);
  }

  syncInfoSelector({ etesync, entries, journals, userInfo });

  return null;
}
