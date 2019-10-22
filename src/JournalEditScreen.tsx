import * as React from 'react';
import { useSelector } from 'react-redux';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { NavigationScreenComponent } from 'react-navigation';
import { useNavigation } from './navigation/Hooks';
import { Text, TextInput, HelperText, Button, Appbar, Paragraph } from 'react-native-paper';

import { SyncManager } from './sync/SyncManager';
import { useSyncGate } from './SyncGate';
import { useCredentials } from './login';
import { store, StoreState } from './store';
import { addJournal, updateJournal, deleteJournal, performSync } from './store/actions';

import Container from './widgets/Container';
import ConfirmationDialog from './widgets/ConfirmationDialog';

import * as EteSync from './api/EteSync';

interface FormErrors {
  displayName?: string;
}

const JournalItemScreen: NavigationScreenComponent = function _JournalItemScreen() {
  const [errors, setErrors] = React.useState({} as FormErrors);
  const [_displayName, setDisplayName] = React.useState(null as string);
  const [_description, setDescription] = React.useState(null as string);
  const { syncInfoCollections } = useSelector(
    (state: StoreState) => ({
      syncInfoCollections: state.cache.syncInfoCollection,
    })
  );
  const syncGate = useSyncGate();
  const navigation = useNavigation();
  const etesync = useCredentials();
  const loading = false;

  if (syncGate) {
    return syncGate;
  }

  const journalUid = navigation.getParam('journalUid');
  let collection = syncInfoCollections.get(journalUid);
  let displayName = _displayName;
  let description = _description;
  if (collection) {
    if (displayName === null) {
      displayName = collection.displayName;
    }
    if (description === null) {
      description = collection.description;
    }
  } else {
    collection = new EteSync.CollectionInfo();
    collection.uid = EteSync.genUid();
    collection.type = navigation.getParam('journalType');
  }

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

    // FIXME having the sync manager here is ugly. We should just deal with these changes centrally.
    const syncManager = SyncManager.getManager(etesync);
    if (journalUid) {
      store.dispatch<any>(updateJournal(etesync, journal)).then(() => {
        store.dispatch(performSync(syncManager.sync()));
        navigation.goBack();
      });
    } else {
      store.dispatch<any>(addJournal(etesync, journal)).then(() => {
        store.dispatch(performSync(syncManager.sync()));
        navigation.goBack();
      });
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

function RightAction() {
  const [confirmationVisible, setConfirmationVisible] = React.useState(false);
  const navigation = useNavigation();
  const etesync = useCredentials();
  const { journals } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
    })
  );

  const journalUid = navigation.getParam('journalUid');
  const journal = journals.get(journalUid);

  return (
    <React.Fragment>
      <Appbar.Action
        icon="delete"
        onPress={() => {
          setConfirmationVisible(true);
        }}
      />
      <ConfirmationDialog
        title="Are you sure?"
        visible={confirmationVisible}
        onOk={() => {
          navigation.navigate('home');
          store.dispatch<any>(deleteJournal(etesync, journal)).then(() => {
            // FIXME having the sync manager here is ugly. We should just deal with these changes centrally.
            const syncManager = SyncManager.getManager(etesync);
            store.dispatch(performSync(syncManager.sync()));
          });
        }}
        onCancel={() => {
          setConfirmationVisible(false);
        }}
      >
        <Paragraph>This colection and all of its data will be removed from the server.</Paragraph>
      </ConfirmationDialog>
    </React.Fragment>
  );
}

JournalItemScreen.navigationOptions = ({ navigation }) => {
  const journalUid = navigation.getParam('journalUid');

  return {
    title: (journalUid) ? 'Edit Collection' : 'Create Collection',
    rightAction: (journalUid) ? (
      <RightAction />
    ) : undefined,
  };
};

export default JournalItemScreen;
