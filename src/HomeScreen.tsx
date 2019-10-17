import * as React from 'react';
import { useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { Appbar } from 'react-native-paper';

import * as Permissions from 'expo-permissions';

import * as moment from 'moment';
import 'moment/locale/en-gb';

import { SyncManager } from './sync/SyncManager';

import JournalListScreen from './components/JournalListScreen';

import { StoreState } from './store';

import { useCredentials } from './login';
import { useSyncGate } from './SyncGate';
import { useSyncInfo } from './SyncHandler';
export * from './SyncHandler'; // FIXME: Should be granular

import { logger } from './logging';

import SyncTempComponent from './sync/SyncTestComponent';

function usePermissions(): boolean {
  const [hasPermissions, setHasPermissions] = React.useState(false);
  const [asked, setAsked] = React.useState(false);

  if (!asked) {
    setAsked(true);
    Permissions.askAsync(Permissions.CALENDAR, Permissions.REMINDERS, Permissions.CONTACTS).then(() => {
      logger.info('Got permissions');
      setHasPermissions(true);
    });
  }

  return hasPermissions;
}

const HomeScreen: NavigationScreenComponent = React.memo(function _HomeScreen() {
  const syncInfo = useSyncInfo();
  const etesync = useCredentials().value;
  const { settings } = useSelector(
    (state: StoreState) => ({
      settings: state.settings,
    })
  );
  const SyncGate = useSyncGate();
  const hasPermissions = usePermissions();

  if (!hasPermissions) {
    // FIXME: show an error message + a button to give permissions
    return <React.Fragment />;
  }

  if (SyncGate) {
    return SyncGate;
  }

  if (false) {
    if (!syncInfo) {
      return <React.Fragment />;
    }

    return (
      <SyncTempComponent
        etesync={etesync}
      />
    );
  }

  // FIXME: Shouldn't be here
  moment.locale(settings.locale);

  return (
    <JournalListScreen />
  );
});

function RefreshIcon() {
  const etesync = useCredentials().value;
  const { fetchCount } = useSelector(
    (state: StoreState) => ({
      fetchCount: state.fetchCount,
    })
  );

  function refresh() {
    const syncManager = SyncManager.getManager(etesync);
    syncManager.sync();
  }

  return (
    <Appbar.Action icon="refresh" disabled={!etesync || fetchCount > 0} onPress={refresh} />
  );
}

HomeScreen.navigationOptions = ({ navigation }) => ({
  rightAction: (
    <RefreshIcon />
  ),
  showMenuButton: true,
});

export default HomeScreen;
