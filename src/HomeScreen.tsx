import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { View } from 'react-native';
import { Appbar, Paragraph, Title } from 'react-native-paper';

import { SyncManager } from './sync/SyncManager';

import JournalListScreen from './components/JournalListScreen';
import { usePermissions, AskForPermissions } from './Permissions';
import Wizard, { WizardNavigationBar, PagePropsType } from './widgets/Wizard';

import { StoreState } from './store';
import { performSync, setSettings } from './store/actions';

import { useCredentials } from './login';
import { useSyncGate } from './SyncGate';
import { registerSyncTask } from './sync/SyncManager';
import SyncSettings from './sync/SyncSettings';

const wizardPages = [
  (props: PagePropsType) => (
    <>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Title style={{ textAlign: 'center' }}>Welcome to EteSync!</Title>
        <Paragraph style={{ textAlign: 'center' }}>
          Please follow these few quick steps to setup the EteSync app.
        </Paragraph>
      </View>
      <WizardNavigationBar {...props} />
    </>
  ),
  (props: PagePropsType) => (
    <>
      <AskForPermissions />
      <WizardNavigationBar {...props} />
    </>
  ),
  (props: PagePropsType) => (
    <>
      <Title>Sync Settings</Title>
      <Paragraph>
        EteSync syncs with your device's existing accounts, so you have to choose an account to sync with to before going forward. For example, if you choose the iCloud account, all of your EteSync data will sync with iCloud.
      </Paragraph>
      <Paragraph>
        iOS doesn't expose the "local" account unless iCloud sync is turned off for this particular sync type. Therefore, in order to only sync EteSync with your device, please first turn off iCloud sync for contacts, calendars and reminders from the device's Settings app.
      </Paragraph>
      <SyncSettings />
      <WizardNavigationBar {...props} />
    </>
  ),
];

const HomeScreen: NavigationScreenComponent = React.memo(function _HomeScreen() {
  const dispatch = useDispatch();
  const etesync = useCredentials()!;
  const SyncGate = useSyncGate();
  const settings = useSelector((state: StoreState) => state.settings);
  const permissionsStatus = usePermissions();

  React.useEffect(() => {
    if (etesync && !permissionsStatus && settings.ranWizrd) {
      registerSyncTask(etesync.credentials.email);
      const syncManager = SyncManager.getManager(etesync);
      dispatch(performSync(syncManager.sync()));
    }
  }, [etesync, !permissionsStatus, settings.ranWizrd]);

  if (permissionsStatus) {
    return permissionsStatus;
  }

  if (!settings.ranWizrd) {
    return <Wizard pages={wizardPages} onFinish={() => dispatch(setSettings({ ranWizrd: true }))} style={{ flex: 1 }} />;
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
