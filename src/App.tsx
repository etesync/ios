import * as React from 'react';
import { Container, Header, Left, Right, Body, Title, Content, Button, Text } from 'native-base';
import { Constants, Font, Calendar, Permissions } from 'expo';

import * as EteSync from './api/EteSync';
import * as C from './constants';

import LoginForm from './components/LoginForm';

import ErrorBoundary from  './ErrorBoundary';

class App extends React.Component {
  state = {
    fontLoaded: false
  };

  constructor(props: any) {
    super(props);
    this.onPress = this.onPress.bind(this);
  }

  async componentWillMount() {
    await Font.loadAsync({
      'Roboto': require('native-base/Fonts/Roboto.ttf'),
      'Roboto_medium': require('native-base/Fonts/Roboto_medium.ttf'),
    });

    this.setState({ fontLoaded: true });
  }

  render() {
    if (!this.state.fontLoaded) {
      return <Text>Loading</Text>
    }

    return (
      <Container style={{ paddingTop: Constants.statusBarHeight }}>
        <Header>
          <Left />
          <Body>
            <Title>{C.appName}</Title>
          </Body>
          <Right />
        </Header>
        <Content>
          <ErrorBoundary>
            <LoginForm
              onSubmit={this.onPress}
            />
          </ErrorBoundary>
        </Content>
      </Container>
    );
  }

  onPress() {
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
