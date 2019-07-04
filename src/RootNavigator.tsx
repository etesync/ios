import * as React from 'react';
import { createStackNavigator } from 'react-navigation';

import HomeScreen from './HomeScreen';
import JournalScreen from './JournalEntriesScreen';
import AppHeader from './AppHeader';

const RootNavigator = createStackNavigator(
  {
    home: {
      screen: HomeScreen,
      navigationOptions: (props: any) => ({
        header: (<AppHeader navigation={props.navigation} home />),
      }),
    },
    Journal: JournalScreen,
  },
  {
    defaultNavigationOptions: ({ navigation }) => ({
      header: (<AppHeader navigation={navigation} />),
    }),
  }
);

export default RootNavigator;
