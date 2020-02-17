import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Appbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

import { SyncManager } from './sync/SyncManager';

import JournalListScreen from './components/JournalListScreen';
import { usePermissions } from './Permissions';

import { StoreState } from './store';
import { performSync } from './store/actions';

import { useCredentials } from './login';
import { useSyncGate } from './SyncGate';
import { registerSyncTask } from './sync/SyncManager';


export default React.memo(function HomeScreen() {
  const etesync = useCredentials()!;
  const dispatch = useDispatch();
  const SyncGate = useSyncGate();
  const navigation = useNavigation();
  const syncCount = useSelector((state: StoreState) => state.syncCount);
  const permissionsStatus = usePermissions();

  React.useEffect(() => {
    if (etesync && !permissionsStatus) {
      registerSyncTask(etesync.credentials.email);
    }
  }, [etesync, !permissionsStatus]);

  function refresh() {
    const syncManager = SyncManager.getManager(etesync);
    dispatch(performSync(syncManager.sync()));
  }

  navigation.setOptions({
    headerRight: () => (
      <Appbar.Action icon="refresh" accessibilityLabel="Synchronize" disabled={!etesync || syncCount > 0} onPress={refresh} />
    ),
  });

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
