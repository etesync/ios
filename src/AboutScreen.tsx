import * as React from 'react';
import { NavigationScreenComponent } from 'react-navigation';
import { ScrollView } from 'react-native';
import { Paragraph } from 'react-native-paper';

import { useSyncGate } from './SyncGate';
import Container from './widgets/Container';

const AboutScreen: NavigationScreenComponent = function _AboutScreen() {
  const syncGate = useSyncGate();

  if (syncGate) {
    return syncGate;
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <Container>
        <Paragraph>
          About the app!
        </Paragraph>
      </Container>
    </ScrollView>
  );
};

AboutScreen.navigationOptions = {
  title: 'About',
};

export default AboutScreen;
