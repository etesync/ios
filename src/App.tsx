import * as React from 'react';
import { Text } from 'react-native';
import { Appbar, DefaultTheme, Provider as PaperProvider } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { Font, Permissions } from 'expo';

import Container from './widgets/Container';

import * as C from './constants';
import * as store from './store';
import * as actions from './store/actions';

import { login, deriveKey } from './store/actions';

import LoginGate from './LoginGate';

import ErrorBoundary from './ErrorBoundary';


const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: 'tomato',
    accent: 'yellow',
  },
};

interface PropsType {
  credentials: store.CredentialsType;
  entries: store.EntriesType;
  fetchCount: number;
}

class App extends React.Component<PropsType> {
  public state = {
    fontLoaded: false,
  };

  constructor(props: PropsType) {
    super(props);
    this.onPress = this.onPress.bind(this);
  }

  public async componentWillMount() {
    await Font.loadAsync({
      Roboto: require('native-base/Fonts/Roboto.ttf'),
      Roboto_medium: require('native-base/Fonts/Roboto_medium.ttf'),
    });

    this.setState({ fontLoaded: true });
  }

  public render() {
    if (!this.state.fontLoaded) {
      return <Text>Loading</Text>;
    }

    return (
      <PaperProvider theme={theme}>
        <Container>
          <Appbar.Header>
            <Appbar.BackAction
            />
            <Appbar.Content
              title={C.appName}
            />
          </Appbar.Header>
          <ErrorBoundary>
            <KeyboardAwareScrollView enableOnAndroid>
              <LoginGate
                credentials={this.props.credentials}
              />
            </KeyboardAwareScrollView>
          </ErrorBoundary>
        </Container>
      </PaperProvider>
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

const mapStateToProps = (state: store.StoreState) => {
  return {
    credentials: credentialsSelector(state),
    entries: state.cache.entries,
    fetchCount: state.fetchCount,
  };
};

export default connect(
  mapStateToProps
)(App);
