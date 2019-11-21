import * as React from 'react';
import { NavigationScreenComponent } from 'react-navigation';
import { ScrollView, Linking } from 'react-native';
import { Title, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { useSyncGate } from './SyncGate';
import Container from './widgets/Container';
import Markdown from './widgets/Markdown';

import { expo } from '../app.json';
import * as C from './constants';

const markdownContent = `
This app is made possible with financial support from [NLnet Foundation](https://nlnet.nl/), courtesy of [NGI0 Discovery](https://nlnet.nl/discovery) and the [European Commission](https://ec.europa.eu) [DG CNECT](https://ec.europa.eu/info/departments/communications-networks-content-and-technology_en)'s [Next Generation Internet](https://ngi.eu) programme.
`;

const AboutScreen: NavigationScreenComponent = function _AboutScreen() {
  const theme = useTheme();
  const syncGate = useSyncGate();

  if (syncGate) {
    return syncGate;
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <Container>
        <Title style={{ textAlign: 'center' }}>EteSync {expo.version}</Title>
        <TouchableRipple onPress={() => { Linking.openURL(C.homePage) }}>
          <Text style={{ textAlign: 'center', color: theme.colors.accent, textDecorationLine: 'underline', margin: 10 }}>{C.homePage}</Text>
        </TouchableRipple>
        <Markdown content={markdownContent} />
      </Container>
    </ScrollView>
  );
};

AboutScreen.navigationOptions = {
  title: 'About',
};

export default AboutScreen;
