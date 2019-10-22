import * as React from 'react';
import { Text } from 'react-native';
import { DefaultTheme, Provider as PaperProvider, Colors } from 'react-native-paper';

import { createAppContainer, createDrawerNavigator } from 'react-navigation';
import RootNavigator from './login/LoginNavigator';

import ErrorBoundary from './ErrorBoundary';
import Drawer from './Drawer';

import { getPersistenceFunctions } from './navigation/persistance';

import { useScreens } from 'react-native-screens';
useScreens();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.amber500,
    accent: Colors.lightBlueA400,
  },
};

const AppNavigator = createAppContainer(createDrawerNavigator(
  { home: RootNavigator },
  {
    contentComponent: Drawer,
    drawerPosition: 'left',
  }
));

class App extends React.Component {
  public state = {
    fontLoaded: false,
  };

  public async componentWillMount() {
    this.setState({ fontLoaded: true });
  }

  public render() {
    if (!this.state.fontLoaded) {
      return <Text>Loading</Text>;
    }

    return (
      <PaperProvider theme={theme}>
        <ErrorBoundary>
          <AppNavigator {...getPersistenceFunctions()} />
        </ErrorBoundary>
      </PaperProvider>
    );
  }
}

export default App;
