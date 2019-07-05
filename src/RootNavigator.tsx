import * as React from 'react';
import { createStackNavigator, HeaderProps } from 'react-navigation';

import HomeScreen from './HomeScreen';
import JournalScreen from './JournalEntriesScreen';
import JournalItemScreen from './JournalItemScreen';
import AppHeader from './AppHeader';

import * as C from './constants';

const RootNavigator = createStackNavigator(
  {
    home: HomeScreen,
    Journal: JournalScreen,
    JournalItem: JournalItemScreen,
  },
  {
    defaultNavigationOptions: ({ navigation }) => ({
      header: (props: HeaderProps) => {
        return (<AppHeader {...props} navigation={navigation as any} />);
      },
      title: C.appName,
    }),
  }
);

export default RootNavigator;
