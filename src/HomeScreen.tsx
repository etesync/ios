import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { Appbar, Text } from 'react-native-paper';

import * as Permissions from 'expo-permissions';

import moment from 'moment';
import 'moment/locale/en-gb';

import { SyncManager } from './sync/SyncManager';

import JournalListScreen from './components/JournalListScreen';
import LoadingIndicator from './widgets/LoadingIndicator';
import Container from './widgets/Container';

import { StoreState } from './store';
import { performSync } from './store/actions';

import { useCredentials } from './login';
import { useSyncGate } from './SyncGate';

import { logger } from './logging';


function usePermissions() {
  const [hasPermissions, setHasPermissions] = React.useState<null | boolean>(null);
  const [asked, setAsked] = React.useState(false);

  if (!asked) {
    setAsked(true);
    (async () => {
      const { status } = await Permissions.askAsync(Permissions.CALENDAR, Permissions.REMINDERS, Permissions.CONTACTS);
      logger.info(`Permissions status: ${status}`);
      setHasPermissions(status === 'granted');
    })();
  }

  if (hasPermissions === null) {
    return (<LoadingIndicator />);
  } else if (hasPermissions === false) {
    // FIXME: show an error message + a button to give permissions
    return (<Text>Please give this app permissions to access your contacts, calendars and tasks from the system settings app.</Text>);
  } else {
    return null;
  }
}

const HomeScreen: NavigationScreenComponent = React.memo(function _HomeScreen() {
  const dispatch = useDispatch();
  const etesync = useCredentials()!;
  const settings = useSelector((state: StoreState) => state.settings);
  const SyncGate = useSyncGate();
  const permissionsStatus = usePermissions();

  React.useEffect(() => {
    if (etesync) {
      const syncManager = SyncManager.getManager(etesync);
      dispatch(performSync(syncManager.sync()));
    }
  }, [etesync]);

  React.useEffect(() => {
    moment.locale(settings.locale);
  }, [settings.locale]);

  if (permissionsStatus) {
    return (
      <Container>
        {permissionsStatus}
      </Container>
    );
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
