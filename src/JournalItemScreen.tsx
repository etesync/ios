import * as React from 'react';
import { NavigationScreenComponent } from 'react-navigation';
import { useNavigation } from './navigation/Hooks';
import { Text } from 'react-native-paper';

import { useSyncInfo } from './SyncHandler';

import LoadingIndicator from './widgets/LoadingIndicator';

const JournalItemScreen: NavigationScreenComponent = function _JournalItemScreen() {
  const syncInfo = useSyncInfo();
  const navigation = useNavigation();

  if (!syncInfo) {
    return (<LoadingIndicator />);
  }

  const journalUid = navigation.getParam('journalUid');
  const entryUid = navigation.getParam('entryUid');
  const syncInfoJournal = syncInfo.get(journalUid);
  const { entries } = syncInfoJournal;

  const entry = entries.find((itr) => {
    return itr.uid === entryUid;
  });

  return (
    <Text>{entry.content}</Text>
  );
};

JournalItemScreen.navigationOptions = {
  title: 'Journal Item',
};

export default JournalItemScreen;
