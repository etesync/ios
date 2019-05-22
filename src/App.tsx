import * as React from 'react';
import { Text } from 'react-native';
import { Appbar, DefaultTheme, Provider as PaperProvider } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Font, Permissions } from 'expo';

import Container from './widgets/Container';

import * as C from './constants';
import { store } from './store';
import { login, deriveKey } from './store/actions';

import LoginForm from './components/LoginForm';

import ErrorBoundary from './ErrorBoundary';


const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: 'tomato',
    accent: 'yellow',
  },
};


class App extends React.Component {
  public state = {
    fontLoaded: false,
  };

  constructor(props: any) {
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
              <LoginForm
                onSubmit={this.onPress}
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
    store.dispatch<any>(login(username, password, encryptionPassword, serviceApiUrl));
  }
}

export default App;
