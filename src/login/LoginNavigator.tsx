import * as React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { createSwitchNavigator, createStackNavigator, NavigationScreenProp, HeaderProps, SafeAreaView } from 'react-navigation';
import { View } from 'react-native';
import { Paragraph, Title } from 'react-native-paper';

import LoginScreen from './LoginScreen';

import RootNavigator from '../RootNavigator';
import SettingsNavigator from '../SettingsNavigator';
import SyncSettings from '../sync/SyncSettings';
import Wizard, { WizardNavigationBar, PagePropsType } from '../widgets/Wizard';
import { AskForPermissions } from '../Permissions';

import { useCredentials } from './';
import { StoreState } from '../store';
import { setSettings } from '../store/actions';

import AppHeader from '../AppHeader';

import * as C from '../constants';
import { isDefined } from '../helpers';

const AuthStack = createStackNavigator(
  {
    Login: LoginScreen,
  },
  {
    defaultNavigationOptions: () => ({
      header: (props: HeaderProps) => {
        return (<AppHeader {...props} />);
      },
      title: C.appName,
    }),
  }
);

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
  (C.syncAppMode) ?
    (props: PagePropsType) => (
      <>
        <Title>Sync Settings</Title>
        <Paragraph>
          EteSync syncs with your device's existing accounts, so you have to choose an account to sync with to before going forward. For example, if you choose the iCloud account, all of your EteSync data will sync with iCloud.
        </Paragraph>
        <Paragraph>
          iOS doesn't expose the "local" account unless all other accounts are disabled. Therefore, in order to only sync EteSync with your device, please first turn off iCloud sync for contacts, calendars and reminders (or only some of them) from the device's Settings app.
        </Paragraph>
        <SyncSettings />
        <WizardNavigationBar {...props} />
      </>
    ) : undefined,
].filter(isDefined);

interface AuthPropsType {
  navigation: NavigationScreenProp<void>;
}

const AuthLoadingScreen = React.memo(function _AuthLoadingScreen(props: AuthPropsType) {
  const settings = useSelector((state: StoreState) => state.settings);
  const dispatch = useDispatch();
  const credentials = useCredentials();
  const { navigation } = props;

  React.useEffect(() => {
    if (!settings.ranWizrd) {
      return;
    }

    if (credentials === null) {
      navigation.navigate('Auth');
    } else {
      navigation.navigate('App');
    }
  }, [settings.ranWizrd]);

  if (!settings.ranWizrd) {
    return (
      <>
        <SafeAreaView />
        <Wizard pages={wizardPages} onFinish={() => dispatch(setSettings({ ranWizrd: true }))} style={{ flex: 1 }} />
      </>
    );
  }

  return <React.Fragment />;
});

export default createSwitchNavigator(
  {
    AuthLoading: AuthLoadingScreen,
    App: RootNavigator,
    Auth: AuthStack,
    SettingsNavigator: SettingsNavigator,
  },
  {
    initialRouteName: 'AuthLoading',
  }
);

