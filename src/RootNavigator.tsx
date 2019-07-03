import * as React from 'react';
import { Appbar } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { createStackNavigator, NavigationScreenProp } from 'react-navigation';

import * as C from './constants';
import SyncGate from './SyncGate';

interface PropsType {
  navigation: NavigationScreenProp<void>;
}

const RootScreen = React.memo(function _RootScreen(props: PropsType) {
  return (
    <KeyboardAwareScrollView enableOnAndroid>
      <SyncGate />
    </KeyboardAwareScrollView>
  );
});

const RootNavigator = createStackNavigator(
  {
    home: RootScreen,
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
