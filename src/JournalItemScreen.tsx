import * as React from 'react';
import { useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { useNavigation } from './navigation/Hooks';
import { Text } from 'react-native-paper';
import { ScrollView } from 'react-native';

import { StoreState } from './store';

import Container from './widgets/Container';

import LoadingIndicator from './widgets/LoadingIndicator';

const JournalItemScreen: NavigationScreenComponent = function _JournalItemScreen() {
  const navigation = useNavigation();
  const { syncInfoEntries, fetchCount } = useSelector(
    (state: StoreState) => ({
      syncInfoEntries: state.cache.syncInfoItem,
      fetchCount: state.fetchCount,
    })
  );

  if (fetchCount > 0) {
    return (<LoadingIndicator />);
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
