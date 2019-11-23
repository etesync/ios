import * as React from 'react';
import { DarkTheme, DefaultTheme, Provider as PaperProvider, Theme, Colors } from 'react-native-paper';

import { AppearanceProvider, useColorScheme } from 'react-native-appearance';

import { createAppContainer, createDrawerNavigator } from 'react-navigation';
import RootNavigator from './login/LoginNavigator';

import ErrorBoundary from './ErrorBoundary';
import Drawer from './Drawer';
import SettingsGate from './SettingsGate';

import { getPersistenceFunctions } from './navigation/persistance';

import { useScreens } from 'react-native-screens';
useScreens();

function InnerApp() {
  const colorScheme = useColorScheme();

  const baseTheme = (colorScheme === 'dark') ? DarkTheme : DefaultTheme;

  const theme: Theme = {
    ...baseTheme,
    mode: 'exact',
    colors: {
      ...baseTheme.colors,
      primary: Colors.amber500,
      accent: Colors.lightBlueA400,
    },
  };

  return (
    <PaperProvider theme={theme}>
      <ErrorBoundary>
        <SettingsGate>
          <AppNavigator {...getPersistenceFunctions()} />
        </SettingsGate>
      </ErrorBoundary>
    </PaperProvider>
  );
}

const AppNavigator = createAppContainer(createDrawerNavigator(
  { home: RootNavigator },
  {
    contentComponent: Drawer,
    drawerPosition: 'left',
  }
));

class App extends React.Component {
  public render() {
    return (
      <AppearanceProvider>
        <InnerApp />
      </AppearanceProvider>
    );
  }
}

export default App;
