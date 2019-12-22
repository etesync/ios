import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { Appbar, Button, Paragraph, Title } from 'react-native-paper';

import * as Permissions from 'expo-permissions';

import { SyncManager } from './sync/SyncManager';

import JournalListScreen from './components/JournalListScreen';
import LoadingIndicator from './widgets/LoadingIndicator';
import Container from './widgets/Container';
import ScrollView from './widgets/ScrollView';

import { StoreState } from './store';
import { performSync, setPermission } from './store/actions';

import { useCredentials } from './login';
import { useSyncGate } from './SyncGate';
import { registerSyncTask } from './sync/SyncManager';

import { logger } from './logging';


function usePermissions() {
  const wantedPermissions: Permissions.PermissionType[] = [Permissions.CALENDAR, Permissions.REMINDERS, Permissions.CONTACTS, Permissions.USER_FACING_NOTIFICATIONS];
  const dispatch = useDispatch();
  const [shouldAsk, setShouldAsk] = React.useState<null | boolean>(null);
  const [asked, setAsked] = React.useState(false);

  if (!asked) {
    setAsked(true);
    (async () => {
      for (const permission of wantedPermissions) {
        const { status } = await Permissions.getAsync(permission);
        logger.info(`Permissions status for ${permission}: ${status}`);
        if (status === Permissions.PermissionStatus.UNDETERMINED) {
          setShouldAsk(true);
          return;
        } else {
          dispatch(setPermission(permission, status === Permissions.PermissionStatus.GRANTED));
        }
      }

      setShouldAsk(false);
    })();
  }

  if (shouldAsk === null) {
    return (<LoadingIndicator />);
  } else if (shouldAsk) {
    return (
      <ScrollView>
        <Container style={{ flex: 1 }}>
          <Title>Permissions</Title>
          <Paragraph>EteSync requires access to your contacts, calendars and reminders in order to be able save them to your device. You can either give EteSync access now or do it later from the device Settings.</Paragraph>
          <Paragraph>EteSync requires the notifications permissions in order for automatic sync to work.</Paragraph>
          <Button mode="contained" style={{ marginTop: 20 }} onPress={() => {
            (async () => {
              for (const permission of wantedPermissions) {
                const { status } = await Permissions.askAsync(permission);
                logger.info(`Permissions status for ${permission}: ${status}`);
                dispatch(setPermission(permission, status === Permissions.PermissionStatus.GRANTED));
              }
              setShouldAsk(false);
            })();
          }}>
            Ask for Permissions
          </Button>
        </Container>
      </ScrollView>
    );
  } else {
    return null;
  }
}

const HomeScreen: NavigationScreenComponent = React.memo(function _HomeScreen() {
  const dispatch = useDispatch();
  const etesync = useCredentials()!;
  const SyncGate = useSyncGate();
  const permissionsStatus = usePermissions();

  React.useEffect(() => {
    if (etesync && !permissionsStatus) {
      registerSyncTask(etesync.credentials.email);
      const syncManager = SyncManager.getManager(etesync);
      dispatch(performSync(syncManager.sync()));
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
