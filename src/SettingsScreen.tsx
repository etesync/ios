import * as React from 'react';
import { NavigationScreenComponent } from 'react-navigation';
import { Linking, ScrollView } from 'react-native';
import { List, Paragraph, HelperText } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';

import * as EteSync from 'etesync';
import sjcl from 'sjcl';

import { logger } from './logging';

import { SyncManager } from './sync/SyncManager';
import { useNavigation } from './navigation/Hooks';
import { useSyncGate } from './SyncGate';
import { useCredentials } from './login';

import ConfirmationDialog from './widgets/ConfirmationDialog';
import PasswordInput from './widgets/PasswordInput';

import { StoreState } from './store';
import { fetchCredentials, fetchUserInfo, updateUserInfo, performSync, deriveKey } from './store/actions';

import * as C from './constants';
import { startTask } from './helpers';

interface DialogPropsType {
  visible: boolean;
  onDismiss: () => void;
}

function AuthenticationPasswordDialog(props: DialogPropsType) {
  const etesync = useCredentials()!;
  const dispatch = useDispatch();
  const [error, setError] = React.useState<string>();
  const [password, setPassword] = React.useState('');

  async function onOk() {
    if (!password) {
      setError('Password can\'t be empty.');
      return;
    }
    try {
      await dispatch<any>(fetchCredentials(etesync.credentials.email, password, etesync.serviceApiUrl));
    } catch (e) {
      setError(e.message);
      return;
    }
    props.onDismiss();
  }

  return (
    <ConfirmationDialog
      title="Authentication Password"
      visible={props.visible}
      onOk={onOk}
      onCancel={props.onDismiss}
    >
      <>
        <Paragraph>
          Please enter your authentication password:
        </Paragraph>
        <PasswordInput
          error={!!error}
          label="Password"
          value={password}
          onChangeText={setPassword}
        />
        <HelperText
          type="error"
          visible={!!error}
        >
          {error}
        </HelperText>
      </>
    </ConfirmationDialog>
  );
}

interface EncryptionFormErrors {
  oldPassword?: string;
  newPassword?: string;
}

function EncryptionPasswordDialog(props: DialogPropsType) {
  const etesync = useCredentials()!;
  const dispatch = useDispatch();
  const [errors, setErrors] = React.useState<EncryptionFormErrors>({});
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const journals = useSelector((state: StoreState) => state.cache.journals);

  async function onOk() {
    const fieldNotEmpty = "Password can't be empty.";
    const errors: EncryptionFormErrors = {};
    if (!oldPassword) {
      errors.oldPassword = fieldNotEmpty;
    }
    if (!newPassword) {
      errors.newPassword = fieldNotEmpty;
    }

    setErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    await startTask(async () => {
      // FIXME: update journal list or maybe fetch all?
      logger.info('Changing encryption password');
      const me = etesync.credentials.email;
      logger.info('Deriving old key');
      const oldDerivedAction = deriveKey(etesync.credentials.email, oldPassword);
      const oldDerived = oldDerivedAction.payload;

      if (oldDerived !== etesync.encryptionKey) {
        setErrors({ oldPassword: 'Error: wrong encryption password.' });
        return;
      }

      logger.info('Deriving new key');
      const newDerivedAction = deriveKey(etesync.credentials.email, newPassword);
      const newDerived = newDerivedAction.payload;
      logger.info('Fetching user info');
      const userInfoAction = await dispatch(fetchUserInfo(etesync, me));
      const userInfo = await userInfoAction.payload;
      const userInfoCryptoManager = userInfo.getCryptoManager(oldDerived);
      const keyPair = userInfo.getKeyPair(userInfoCryptoManager);

      logger.info('Updating journals');
      for (const journal of journals.values()) {
        if (journal.key) {
          // Skip journals that already have a key (includes one we don't own)
          continue;
        }

        // FIXME: Add a warning message like in Android + mention in it not to stop it
        const cryptoManager = journal.getCryptoManager(oldDerived, keyPair);

        const pubkeyBytes = keyPair.publicKey;
        const encryptedKey = sjcl.codec.base64.fromBits(sjcl.codec.bytes.toBits(cryptoManager.getEncryptedKey(keyPair, pubkeyBytes)));

        const journalMembersManager = new EteSync.JournalMembersManager(etesync.credentials, etesync.serviceApiUrl, journal.uid);
        logger.info(`Updating journal ${journal.uid}`);
        try {
          await journalMembersManager.create({ user: me, key: encryptedKey, readOnly: false });
        } catch (e) {
          setErrors({ newPassword: e.toString() });
          return;
        }
      }

      // FIXME: the performSync is a hack to make sure we don't update any screens before we've update the store
      await dispatch(performSync((async () => {
        logger.info('Updating user info');
        try {
          const newCryptoManager = userInfo.getCryptoManager(newDerived);
          userInfo.setKeyPair(newCryptoManager, keyPair);

          await dispatch(updateUserInfo(etesync, userInfo));
        } catch (e) {
          setErrors({ newPassword: e.toString() });
          return false;
        }

        dispatch(newDerivedAction);

        const syncManager = SyncManager.getManager({ ...etesync, encryptionKey: newDerived });
        await syncManager.sync();

        props.onDismiss();

        return true;
      })()));
    });
  }

  return (
    <ConfirmationDialog
      title="Change Encryption Password"
      visible={props.visible}
      onOk={onOk}
      onCancel={props.onDismiss}
    >
      <>
        <PasswordInput
          error={!!errors.oldPassword}
          label="Current Password"
          value={oldPassword}
          onChangeText={setOldPassword}
        />
        <HelperText
          type="error"
          visible={!!errors.oldPassword}
        >
          {errors.oldPassword}
        </HelperText>

        <PasswordInput
          error={!!errors.newPassword}
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <HelperText
          type="error"
          visible={!!errors.newPassword}
        >
          {errors.newPassword}
        </HelperText>
      </>
    </ConfirmationDialog>
  );
}

const SettingsScreen: NavigationScreenComponent = function _SettingsScreen() {
  const etesync = useCredentials();
  const syncGate = useSyncGate();
  const navigation = useNavigation();

  const [showAuthDialog, setShowAuthDialog] = React.useState(false);
  const [showEncryptionDialog, setShowEncryptionDialog] = React.useState(false);

  if (syncGate) {
    return syncGate;
  }

  const loggedIn = etesync && etesync.credentials && etesync.encryptionKey;

  return (
    <>
      <ScrollView style={{ flex: 1 }}>
        {loggedIn && (
          <List.Section>
            <List.Subheader>Account</List.Subheader>
            <List.Item
              title="Account Dashboard"
              description="Change your payment info, plan and other account settings"
              onPress={() => { Linking.openURL(C.dashboard) }}
            />
            <List.Item
              title="Authentication Password"
              description="Use a different authentication password"
              onPress={() => { setShowAuthDialog(true) }}
            />
            <List.Item
              title="Encryption Password"
              description="Change your encryption password"
              onPress={() => { setShowEncryptionDialog(true) }}
            />
          </List.Section>
        )}

        <List.Section>
          <List.Subheader>About</List.Subheader>
          <List.Item
            title="About"
            description="About the app"
            onPress={() => {
              navigation.navigate('About');
            }}
          />
        </List.Section>
      </ScrollView>

      <AuthenticationPasswordDialog visible={showAuthDialog} onDismiss={() => setShowAuthDialog(false)} />
      <EncryptionPasswordDialog visible={showEncryptionDialog} onDismiss={() => setShowEncryptionDialog(false)} />
    </>
  );
};

SettingsScreen.navigationOptions = {
  title: 'Settings',
};

export default SettingsScreen;
