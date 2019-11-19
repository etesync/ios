import * as React from 'react';
import { createStackNavigator, HeaderProps } from 'react-navigation';

import HomeScreen from './HomeScreen';
import JournalScreen from './JournalEntriesScreen';
import JournalItemScreen from './JournalItemScreen';
import JournalEditScreen from './JournalEditScreen';
import JournalImportScreen from './JournalImportScreen';
import JournalMembersScreen from './JournalMembersScreen';
import SettingsScreen from './SettingsScreen';
import AboutScreen from './AboutScreen';
import AppHeader from './AppHeader';

import * as C from './constants';

const RootNavigator = createStackNavigator(
  {
    home: HomeScreen,
    Journal: JournalScreen,
    JournalNew: JournalEditScreen,
    JournalEdit: JournalEditScreen,
    JournalItem: JournalItemScreen,
    JournalImport: JournalImportScreen,
    JournalMembers: JournalMembersScreen,
    Settings: SettingsScreen,
    About: AboutScreen,
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
