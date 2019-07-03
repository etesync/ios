import * as React from 'react';
import { Appbar } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import * as Permissions from 'expo-permissions';
import { NavigationScreenProp } from 'react-navigation';

import Container from './widgets/Container';

import * as C from './constants';
import * as store from './store';
import * as actions from './store/actions';

import { login, deriveKey } from './store/actions';

import LoginGate from './LoginGate';

interface PropsType {
  navigation: NavigationScreenProp<void>;
}

type PropsTypeInner = PropsType & {
  credentials: store.CredentialsType;
  entries: store.EntriesType;
  fetchCount: number;
};

class RootNavigator extends React.Component<PropsTypeInner> {
  constructor(props: PropsTypeInner) {
    super(props);
    this.onPress = this.onPress.bind(this);
  }

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

  public onEncryptionFormSubmit(encryptionPassword: string) {
    return [deriveKey, encryptionPassword];
    // store.dispatch(deriveKey(this.props.credentials.value!.credentials.email, encryptionPassword));
  }

  public onPress(username: string, password: string, encryptionPassword: string, serviceApiUrl?: string) {
    Permissions.askAsync(Permissions.CALENDAR, Permissions.CONTACTS);

    serviceApiUrl = serviceApiUrl ? serviceApiUrl : C.serviceApiBase;
    store.store.dispatch<any>(login(username, password, encryptionPassword, serviceApiUrl));
  }

  public refresh() {
    store.store.dispatch<any>(actions.fetchAll(this.props.credentials.value!, this.props.entries));
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
    entries: state.cache.entries,
    fetchCount: state.fetchCount,
  };
};

export default connect(
  mapStateToProps
)(RootNavigator);
