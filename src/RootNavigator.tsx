import * as React from 'react';
import { Text } from 'react-native';
import { Appbar } from 'react-native-paper';
import { createStackNavigator } from 'react-navigation';

import * as C from './constants';
import HomeScreen from './HomeScreen';

const RootNavigator = createStackNavigator(
  {
    home: HomeScreen,
    Journal: () => <Text>Hello</Text>,
  },
  {
    defaultNavigationOptions: ({ navigation }) => ({
      header: (
        <Appbar.Header>
          <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} />
          <Appbar.Content title={C.appName} />
        </Appbar.Header>
      ),
    }),
  }
);

export default RootNavigator;
