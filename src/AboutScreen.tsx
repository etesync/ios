import * as React from 'react';
import { NavigationScreenComponent } from 'react-navigation';
import { ScrollView } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { useSyncGate } from './SyncGate';
import Container from './widgets/Container';

const markdownContent = `# EteSync

This is the about page for this app.
`;

const AboutScreen: NavigationScreenComponent = function _AboutScreen() {
  const syncGate = useSyncGate();

  if (syncGate) {
    return syncGate;
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <Container>
        <Markdown>
          {markdownContent}
        </Markdown>
      </Container>
    </ScrollView>
  );
};

AboutScreen.navigationOptions = {
  title: 'About',
};

export default AboutScreen;
