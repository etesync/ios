import * as React from 'react';
import { Text } from 'react-native';
import { DefaultTheme, Provider as PaperProvider } from 'react-native-paper';

import * as Font from 'expo-font';

import { createAppContainer, createDrawerNavigator } from 'react-navigation';
import RootNavigator from './RootNavigator';

import ErrorBoundary from './ErrorBoundary';

import { useScreens } from 'react-native-screens';
useScreens();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#FFC107', // amber
    accent: '#00B0FF', // lightBlue.A400
  },
};

const AppNavigator = createAppContainer(createDrawerNavigator(
  { home: RootNavigator },
  {
    contentComponent: () => {
      return <Text>Drawer</Text>;
    },
    drawerPosition: 'left',
  }
));

class App extends React.Component {
  public state = {
    fontLoaded: false,
  };

  public async componentWillMount() {
    await Font.loadAsync({
      Roboto: require('../node_modules/native-base/Fonts/Roboto.ttf'),
      Roboto_medium: require('../node_modules/native-base/Fonts/Roboto_medium.ttf'),
    });

    this.setState({ fontLoaded: true });
  }

  public render() {
    if (!this.state.fontLoaded) {
      return <Text>Loading</Text>;
    }

    return (
      <PaperProvider theme={theme}>
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
      </PaperProvider>
    );
  }
}

export default App;
