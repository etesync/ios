import * as React from 'react';
import { NavigationScreenComponent } from 'react-navigation';
import { Linking, ScrollView } from 'react-native';
import { List, Paragraph, HelperText } from 'react-native-paper';
import { useDispatch } from 'react-redux';

import { useNavigation } from './navigation/Hooks';
import { useSyncGate } from './SyncGate';
import { useCredentials } from './login';

import ConfirmationDialog from './widgets/ConfirmationDialog';
import PasswordInput from './widgets/PasswordInput';

import { fetchCredentials } from './store/actions';

import * as C from './constants';

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

const SettingsScreen: NavigationScreenComponent = function _SettingsScreen() {
  const etesync = useCredentials();
  const syncGate = useSyncGate();
  const navigation = useNavigation();

  const [showAuthDialog, setShowAuthDialog] = React.useState(false);

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
              disabled
              onPress={() => {}}
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
    </>
  );
};

SettingsScreen.navigationOptions = {
  title: 'Settings',
};

export default SettingsScreen;
