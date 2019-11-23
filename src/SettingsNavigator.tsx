import * as React from 'react';
import { createStackNavigator, HeaderProps } from 'react-navigation';

import SettingsScreen from './SettingsScreen';
import AboutScreen from './AboutScreen';
import DebugLogsScreen from './DebugLogsScreen';
import AppHeader from './AppHeader';

import * as C from './constants';

const SettingsNavigator = createStackNavigator(
  {
    Settings: SettingsScreen,
    About: AboutScreen,
    DebugLogs: DebugLogsScreen,
  },
  {
    initialRouteName: 'Settings',
    defaultNavigationOptions: ({ navigation }) => ({
      header: (props: HeaderProps) => {
        return (<AppHeader {...props} navigation={navigation as any} />);
      },
      title: C.appName,
    }),
  }
);

export default SettingsNavigator;
