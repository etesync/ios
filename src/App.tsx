import * as React from 'react';
import { Text } from 'react-native';
import { Appbar, DefaultTheme, Provider as PaperProvider } from 'react-native-paper';
import { Constants, Font, Permissions } from 'expo';

import Container from './widgets/Container';

import * as EteSync from './api/EteSync';
import * as C from './constants';

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
        <Container style={{ paddingTop: Constants.statusBarHeight }}>
          <Appbar.Header>
            <Appbar.BackAction
            />
            <Appbar.Content
              title={C.appName}
            />
          </Appbar.Header>
          <ErrorBoundary>
            <LoginForm
              onSubmit={this.onPress}
            />
          </ErrorBoundary>
        </Container>
      </PaperProvider>
    );
  }

  public onPress() {
    Permissions.askAsync(Permissions.CALENDAR);

    const server = 'http://lenovo:8000';
    const authenticator = new EteSync.Authenticator(server);

    const username = 'me@etesync.com';
    const password = 'qqqqqqqq';

    authenticator.getAuthToken(username, password).then(
      (authToken) => {
        const creds = new EteSync.Credentials(username, authToken);

        const context = {
          serviceApiUrl: server,
          credentials: creds,
        };

        console.log(context);
      },
      (error) => {
        console.log(error);
      }
    );
  }
}

export default App;
