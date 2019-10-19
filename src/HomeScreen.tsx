import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { Appbar, Text } from 'react-native-paper';

import * as Permissions from 'expo-permissions';

import * as moment from 'moment';
import 'moment/locale/en-gb';

import { SyncManager } from './sync/SyncManager';

import JournalListScreen from './components/JournalListScreen';

import { StoreState } from './store';
import { performSync } from './store/actions';

import { useCredentials } from './login';
import { useSyncGate } from './SyncGate';
export * from './SyncHandler'; // FIXME: Should be granular

import { logger } from './logging';


function usePermissions(): boolean {
  const [hasPermissions, setHasPermissions] = React.useState(false);
  const [asked, setAsked] = React.useState(false);

  if (!asked) {
    setAsked(true);
    (async () => {
      const { status } = await Permissions.askAsync(Permissions.CALENDAR, Permissions.REMINDERS, Permissions.CONTACTS);
      logger.info(`Permissions status: ${status}`);
      setHasPermissions(status === 'granted');
    })();
  }

  return hasPermissions;
}

const HomeScreen: NavigationScreenComponent = React.memo(function _HomeScreen() {
  const dispatch = useDispatch();
  const etesync = useCredentials().value;
  const { settings } = useSelector(
    (state: StoreState) => ({
      settings: state.settings,
    })
  );
  const SyncGate = useSyncGate();
  const hasPermissions = usePermissions();

  React.useMemo(() => {
    const syncManager = SyncManager.getManager(etesync);
    dispatch(performSync(syncManager.sync()));
  }, [etesync]);

  React.useMemo(() => {
    moment.locale(settings.locale);
  }, [settings.locale]);

  if (!hasPermissions) {
    // FIXME: show an error message + a button to give permissions
    return <Text>Permissions denied. Please give the app permissions from the settings</Text>;
  }

  if (SyncGate) {
    return SyncGate;
  }

  return (
    <JournalListScreen />
  );
});

function RefreshIcon() {
  const etesync = useCredentials().value;
  const dispatch = useDispatch();
  const { fetchCount } = useSelector(
    (state: StoreState) => ({
      fetchCount: state.fetchCount,
    })
  );

  function refresh() {
    const syncManager = SyncManager.getManager(etesync);
    dispatch(performSync(syncManager.sync()));
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
