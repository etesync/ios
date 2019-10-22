import * as React from 'react';
import { useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { useNavigation } from './navigation/Hooks';
import { Text } from 'react-native-paper';
import { ScrollView } from 'react-native';

import { useSyncGate } from './SyncGate';
import { StoreState } from './store';

import Container from './widgets/Container';

const JournalItemScreen: NavigationScreenComponent = function _JournalItemScreen() {
  const navigation = useNavigation();
  const syncGate = useSyncGate();
  const { syncInfoEntries } = useSelector(
    (state: StoreState) => ({
      syncInfoEntries: state.cache.syncInfoItem,
    })
  );

  if (syncGate) {
    return syncGate;
  }

  const journalUid = navigation.getParam('journalUid');
  const entryUid = navigation.getParam('entryUid');
  const entries = syncInfoEntries.get(journalUid);

  const entry = entries.get(entryUid);

  return (
    <ScrollView style={{ flex: 1 }}>
      <Container>
        <Text>{entry.content}</Text>
      </Container>
    </ScrollView>
  );
};

JournalItemScreen.navigationOptions = {
  title: 'Journal Item',
};

export default JournalItemScreen;
