import * as React from 'react';
import { useSelector } from 'react-redux';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { NavigationScreenComponent } from 'react-navigation';
import { useNavigation } from './navigation/Hooks';
import { Text, TextInput, HelperText, Button } from 'react-native-paper';

import { useCredentials } from './login';
import { store, StoreState } from './store';
import { addJournal, updateJournal } from './store/actions';

import Container from './widgets/Container';

import * as EteSync from './api/EteSync';
import LoadingIndicator from './widgets/LoadingIndicator';

interface FormErrors {
  displayName?: string;
}

const JournalItemScreen: NavigationScreenComponent = function _JournalItemScreen() {
  const [errors, setErrors] = React.useState({} as FormErrors);
  const [_displayName, setDisplayName] = React.useState(null as string);
  const [_description, setDescription] = React.useState(null as string);
  const { syncInfoCollections, fetchCount } = useSelector(
    (state: StoreState) => ({
      syncInfoCollections: state.cache.syncInfoCollection,
      fetchCount: state.fetchCount,
    })
  );
  const navigation = useNavigation();
  const etesync = useCredentials();
  const loading = false;

  if (fetchCount > 0) {
    return (<LoadingIndicator />);
  }

  const journalUid = navigation.getParam('journalUid');
  const collection = syncInfoCollections.get(journalUid);

  const displayName = (_displayName !== null) ? _displayName : collection.displayName;
  const description = (_description !== null) ? _description : collection.description;

  function onSave() {
    const saveErrors: FormErrors = {};
    const fieldRequired = 'This field is required!';

    if (!displayName) {
      saveErrors.displayName = fieldRequired;
    }

    if (Object.keys(saveErrors).length > 0) {
      setErrors(saveErrors);
      return;
    }

    const info = new EteSync.CollectionInfo({ ...collection, displayName, description });
    const journal = new EteSync.Journal();
    const cryptoManager = new EteSync.CryptoManager(etesync.encryptionKey, info.uid);
    journal.setInfo(cryptoManager, info);

    if (journalUid) {
      store.dispatch<any>(updateJournal(etesync, journal)).then(() =>
        navigation.goBack()
      );
    } else {
      store.dispatch<any>(addJournal(etesync, journal)).then(() =>
        navigation.goBack()
      );
    }
  }

  return (
    <KeyboardAwareScrollView>
      <Container>
        <TextInput
          autoFocus
          returnKeyType="next"
          error={!!errors.displayName}
          onChangeText={setDisplayName}
          label="Display name (title)"
          value={displayName}
        />
        <HelperText
          type="error"
          visible={!!errors.displayName}
        >
          {errors.displayName}
        </HelperText>

        <TextInput
          onChangeText={setDescription}
          label="Description (optional)"
          value={description}
        />

        <Button
          mode="contained"
          disabled={loading}
          onPress={onSave}
        >
          <Text>{loading ? 'Loading…' : 'Save'}</Text>
        </Button>
      </Container>
    </KeyboardAwareScrollView>
  );
};

JournalItemScreen.navigationOptions = {
  title: 'Journal Edit',
};

export default JournalItemScreen;
