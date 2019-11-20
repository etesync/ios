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
import ErrorOrLoadingDialog from './widgets/ErrorOrLoadingDialog';

import * as EteSync from 'etesync';
import { useLoading } from './helpers';

interface FormErrors {
  displayName?: string;
}

const JournalEditScreen: NavigationScreenComponent = function _JournalEditScreen() {
  const [errors, setErrors] = React.useState({} as FormErrors);
  const [_displayName, setDisplayName] = React.useState<string | null>(null);
  const [_description, setDescription] = React.useState<string | null>(null);
  const { syncInfoCollections, journals, userInfo } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
      syncInfoCollections: state.cache.syncInfoCollection,
      userInfo: state.cache.userInfo,
    })
  );
  const syncGate = useSyncGate();
  const navigation = useNavigation();
  const etesync = useCredentials()!;
  const [loading, error, setPromise] = useLoading();

  if (syncGate) {
    return syncGate;
  }

  const journalUid: string = navigation.getParam('journalUid') ?? '';
  let collection = syncInfoCollections.get(journalUid);
  const displayName = _displayName ?? collection?.displayName ?? '';
  const description = _description ?? collection?.description ?? '';
  if (!collection) {
    collection = new EteSync.CollectionInfo();
    collection.uid = EteSync.genUid();
    collection.type = navigation.getParam('journalType');
  }

  function onSave() {
    setPromise(async () => {
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
      const journal = new EteSync.Journal((journals.has(journalUid)) ? journals.get(journalUid)!.serialize() : { uid: info.uid });
      const keyPair = userInfo.getKeyPair(userInfo.getCryptoManager(etesync.encryptionKey));
      const cryptoManager = journal.getCryptoManager(etesync.encryptionKey, keyPair);
      journal.setInfo(cryptoManager, info);

      if (journalUid) {
        await store.dispatch(updateJournal(etesync, journal));
      } else {
        await store.dispatch(addJournal(etesync, journal));
      }

      // FIXME having the sync manager here is ugly. We should just deal with these changes centrally.
      const syncManager = SyncManager.getManager(etesync);
      store.dispatch(performSync(syncManager.sync()));
      navigation.goBack();
    });
  }

  return (
    <KeyboardAwareScrollView>
      <Container>
        <ErrorOrLoadingDialog
          loading={loading}
          error={error}
          onDismiss={() => setPromise(undefined)}
        />
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
  const etesync = useCredentials()!;
  const { journals } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
    })
  );

  const journalUid = navigation.getParam('journalUid');
  const journal = journals.get(journalUid)!;

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
        onOk={async () => {
          await store.dispatch(deleteJournal(etesync, journal));
          navigation.navigate('home');
          // FIXME having the sync manager here is ugly. We should just deal with these changes centrally.
          const syncManager = SyncManager.getManager(etesync);
          store.dispatch(performSync(syncManager.sync()));
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

JournalEditScreen.navigationOptions = ({ navigation }) => {
  const journalUid = navigation.getParam('journalUid');

  return {
    title: (journalUid) ? 'Edit Collection' : 'Create Collection',
    rightAction: (journalUid) ? (
      <RightAction />
    ) : undefined,
  };
};

export default JournalEditScreen;
