import * as React from 'react';
import { Appbar } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { NavigationScreenProp } from 'react-navigation';

import Container from './widgets/Container';

import * as C from './constants';
import * as store from './store';

import LoginGate from './LoginGate';

interface PropsType {
  navigation: NavigationScreenProp<void>;
}

type PropsTypeInner = PropsType & {
  credentials: store.CredentialsType;
};

class RootNavigator extends React.Component<PropsTypeInner> {
  public render() {
    const { navigation } = this.props;

    return (
      <Container>
        <Appbar.Header>
          <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} />
          <Appbar.Content
            title={C.appName}
          />
        </Appbar.Header>
        <KeyboardAwareScrollView enableOnAndroid>
          <LoginGate
            credentials={this.props.credentials}
          />
        </KeyboardAwareScrollView>
      </Container>
    );
  }
}

const credentialsSelector = createSelector(
  (state: store.StoreState) => state.credentials.value,
  (state: store.StoreState) => state.credentials.error,
  (state: store.StoreState) => state.credentials.fetching,
  (state: store.StoreState) => state.encryptionKey.key,
  (value, error, fetching, encryptionKey) => {
    if (value === null) {
      return {value, error, fetching};
    }

    return {
      error,
      fetching,
      value: {
        ...value,
        encryptionKey,
      },
    } as store.CredentialsType;
  }
);

const mapStateToProps = (state: store.StoreState, props: PropsTypeInner) => {
  return {
    credentials: credentialsSelector(state),
  };
};

export default connect(
  mapStateToProps
)(RootNavigator);
