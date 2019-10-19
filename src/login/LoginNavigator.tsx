import * as React from 'react';
import { createSwitchNavigator, createStackNavigator, NavigationScreenProp, HeaderProps } from 'react-navigation';

import LoginScreen from './LoginScreen';

import RootNavigator from '../RootNavigator';

import { useCredentials } from './';

import AppHeader from '../AppHeader';

import * as C from '../constants';

const AuthStack = createStackNavigator(
  {
    Login: LoginScreen,
  },
  {
    defaultNavigationOptions: ({ navigation }) => ({
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
  const credentials = useCredentials();
  const { navigation } = props;

  React.useEffect(() => {
    if (credentials === null) {
      navigation.navigate('Auth');
    } else {
      navigation.navigate('App');
    }
  });

  return <React.Fragment />;
});

export default createSwitchNavigator(
  {
    AuthLoading: AuthLoadingScreen,
    App: RootNavigator,
    Auth: AuthStack,
  },
  {
    initialRouteName: 'AuthLoading',
  }
);

