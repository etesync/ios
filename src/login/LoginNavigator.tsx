import * as React from 'react';
import { createSwitchNavigator, createStackNavigator, NavigationScreenProp } from 'react-navigation';

import LoginScreen from './LoginScreen';

import RootNavigator from '../RootNavigator';

import { useCredentials } from './';

const AuthStack = createStackNavigator(
  {
    Login: LoginScreen,
  }
);

interface AuthPropsType {
  navigation: NavigationScreenProp<void>;
}

const AuthLoadingScreen = React.memo(function _AuthLoadingScreen(props: AuthPropsType) {
  const credentials = useCredentials();
  const { navigation } = props;

  React.useEffect(() => {
    if (credentials.value === null) {
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

