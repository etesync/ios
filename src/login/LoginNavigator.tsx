import * as React from 'react';
import { createSwitchNavigator, createStackNavigator, NavigationScreenProp, HeaderProps } from 'react-navigation';
import { Linking } from 'react-native';
import { Paragraph } from 'react-native-paper';

import LoginScreen from './LoginScreen';

import RootNavigator from '../RootNavigator';
import SettingsNavigator from '../SettingsNavigator';

import { useCredentials } from './';

import AppHeader from '../AppHeader';
import ConfirmationDialog from '../widgets/ConfirmationDialog';

import * as C from '../constants';

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

interface AuthPropsType {
  navigation: NavigationScreenProp<void>;
}

const AuthLoadingScreen = React.memo(function _AuthLoadingScreen(props: AuthPropsType) {
  const [showUpgradeDialog, setShowUpgradeDialog] = React.useState(true);
  const credentials = useCredentials();
  const { navigation } = props;

  React.useEffect(() => {
    if (showUpgradeDialog) {
      return;
    }

    if (credentials === null) {
      navigation.navigate('Auth');
    } else {
      navigation.navigate('App');
    }
  });

  return (
    <ConfirmationDialog
      title="Please Upgrade"
      visible={showUpgradeDialog}
      labelOk="Upgrade"
      onOk={() => Linking.openURL('https://blog.etesync.com/the-ios-client-is-now-available-on-the-app-store/#upgrading-from-the-beta-expo-app')}
      onCancel={() => setShowUpgradeDialog(false)}
    >
      <Paragraph>
        EteSync is now available on the App Store! Please follow the upgrade instructions in the release blog post to upgrade from the beta Expo version.
      </Paragraph>
    </ConfirmationDialog>
  );
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

