import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { Appbar } from 'react-native-paper';

import { SyncManager } from './sync/SyncManager';

import JournalListScreen from './components/JournalListScreen';
import { usePermissions } from './Permissions';

import { StoreState } from './store';
import { performSync } from './store/actions';

import { useCredentials } from './login';
import { useSyncGate } from './SyncGate';
import { registerSyncTask } from './sync/SyncManager';


const HomeScreen: NavigationScreenComponent = React.memo(function _HomeScreen() {
  const etesync = useCredentials()!;
  const SyncGate = useSyncGate();
  const permissionsStatus = usePermissions();

  React.useEffect(() => {
    if (etesync && !permissionsStatus) {
      registerSyncTask(etesync.credentials.email);
    }
  }, [etesync, !permissionsStatus]);

  if (permissionsStatus) {
    return permissionsStatus;
  }

  if (SyncGate) {
    return SyncGate;
  }

  return (
    <JournalListScreen />
  );
});

function RefreshIcon() {
  const etesync = useCredentials()!;
  const dispatch = useDispatch();
  const fetchCount = useSelector((state: StoreState) => state.fetchCount);
  const syncCount = useSelector((state: StoreState) => state.syncCount);

  function refresh() {
    const syncManager = SyncManager.getManager(etesync);
    dispatch(performSync(syncManager.sync()));
  }

  return (
    <Appbar.Action icon="refresh" disabled={!etesync || fetchCount > 0 || syncCount > 0} onPress={refresh} />
  );
}

HomeScreen.navigationOptions = () => ({
  rightAction: (
    <RefreshIcon />
  ),
  showMenuButton: true,
});

export default HomeScreen;
