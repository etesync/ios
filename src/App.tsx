import * as React from 'react';
import { Text, View, Button } from 'react-native';
import { Calendar, Permissions } from 'expo';

import * as EteSync from './api/EteSync';

import ErrorBoundary from  './ErrorBoundary';

class App extends React.Component {
  constructor(props: any) {
    super(props);
    this.onPress = this.onPress.bind(this);
  }

  render() {
    return (
      <ErrorBoundary>
        <View style={{ marginTop: 50 }}>
          <Text>Hello Expo tom!</Text>
          <Button title="Click" onPress={this.onPress} />
        </View>
      </ErrorBoundary>
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
