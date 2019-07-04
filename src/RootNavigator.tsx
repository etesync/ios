import * as React from 'react';
import { createStackNavigator } from 'react-navigation';

import HomeScreen from './HomeScreen';
import JournalScreen from './JournalEntriesScreen';
import AppHeader from './AppHeader';

const RootNavigator = createStackNavigator(
  {
    home: {
      screen: HomeScreen,
      navigationOptions: () => ({
        header: (<AppHeader home />),
      }),
    },
    Journal: JournalScreen,
  },
  {
    defaultNavigationOptions: ({ navigation }) => ({
      header: (<AppHeader />),
    }),
  }
);

export default RootNavigator;
