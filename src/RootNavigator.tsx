import * as React from 'react';
import { Appbar } from 'react-native-paper';
import { createStackNavigator } from 'react-navigation';

import * as C from './constants';
import HomeScreen from './HomeScreen';
// import JournalScreen from './JournalScreen';

const RootNavigator = createStackNavigator(
  {
    home: {
      screen: HomeScreen,
      navigationOptions: (params: any) => ({
        header: (
          <Appbar.Header>
            <Appbar.Action icon="menu" onPress={() => params.navigation.openDrawer()} />
            <Appbar.Content title={C.appName} />
          </Appbar.Header>
        ),
      }),
    },
    Journal: React.Fragment,
  },
  {
    defaultNavigationOptions: ({ navigation }) => ({
      header: (
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={C.appName} />
        </Appbar.Header>
      ),
    }),
  }
);

export default RootNavigator;
