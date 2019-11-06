import * as React from 'react';
import { useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { useNavigation } from './navigation/Hooks';
import { View, ScrollView } from 'react-native';
import { Avatar, List, Appbar, Paragraph, TextInput, HelperText } from 'react-native-paper';

import { useSyncGate } from './SyncGate';
import { useCredentials } from './login';
import { StoreState } from './store';

import Checkbox from './widgets/Checkbox';
import PrettyFingerprint from './widgets/PrettyFingerprint';
import Container from './widgets/Container';
import LoadingIndicator from './widgets/LoadingIndicator';
import ConfirmationDialog from './widgets/ConfirmationDialog';
import ErrorDialog from './widgets/ErrorDialog';

import * as EteSync from './api/EteSync';
import sjcl from 'sjcl';

const JournalMembersScreen: NavigationScreenComponent = function _JournalMembersScreen() {
  const [members, setMembers] = React.useState<EteSync.JournalMemberJson[] | undefined>(undefined);
  const [revokeUser, setRevokeUser] = React.useState<EteSync.JournalMemberJson | undefined>(undefined);
  const { journals } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
    })
  );
  const syncGate = useSyncGate();
  const navigation = useNavigation();
  const etesync = useCredentials()!;

  if (syncGate) {
    return syncGate;
  }

  const journalUid = navigation.getParam('journalUid');
  const journal = journals.get(journalUid)!;

  let error: string | undefined;
  if (journal.version < 2) {
    error = 'Sharing of old-style collections is not allowed. In order to share this collection, create a new one, and copy its contents over using the "import" dialog. If you are experiencing any issues, please contact support.';
  } else if (journal.owner !== etesync.credentials.email) {
    error = `Only the owner of the collection (${journal.owner}) can view and modify its members.`;
  }

  if (error) {
    return (
      <ErrorDialog
        error={error}
        onOk={() => {
          navigation.goBack();
        }}
      />
    );
  }

  if (!members) {
    const journalMembersManager = new EteSync.JournalMembersManager(etesync.credentials, etesync.serviceApiUrl, journalUid);
    journalMembersManager.list().then((retMembers) => {
      setMembers(retMembers);
    });

    return (
      <LoadingIndicator />
    );
  }

  return (
    <ScrollView>
      <Container>
        { (members.length > 0) ?
          members.map((member) => (
            <List.Item
              key={member.user}
              title={member.user}
              right={(props: any) => (
                <View {...props} style={{ flexDirection: 'row' }}>
                  {member.readOnly &&
                    <Avatar.Icon icon="eye" size={36} style={{ backgroundColor: '#ffffff' }} />
                  }
                </View>
              )}
              onPress={() => setRevokeUser(member)}
            />
          )) :
          (<Paragraph>No members</Paragraph>)
        }
      </Container>
      <ConfirmationDialog
        title="Remove member"
        visible={!!revokeUser}
        onOk={() => {
          const journalMembersManager = new EteSync.JournalMembersManager(etesync.credentials, etesync.serviceApiUrl, journalUid);
          return journalMembersManager.delete(revokeUser!).then(() => {
            setRevokeUser(undefined);
            navigation.goBack();
          });
        }}
        onCancel={() => {
          setRevokeUser(undefined);
        }}
      >
        <Paragraph>
          Would you like to revoke {revokeUser?.user}'s access?
        </Paragraph>
        <Paragraph>
          Please be advised that a malicious user would potentially be able to retain access to encryption keys. Please refer to the FAQ for more information.
        </Paragraph>
      </ConfirmationDialog>
    </ScrollView>
  );
};

function RightAction() {
  const [memberDialogVisible, setMemberDialogVisible] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [readOnly, setReadOnly] = React.useState(false);
  const [publicKey, setPublicKey] = React.useState('');
  const [errorUsername, setErrorUsername] = React.useState<string | null>(null);
  const navigation = useNavigation();
  const etesync = useCredentials()!;
  const { journals, userInfo } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
      userInfo: state.cache.userInfo,
    })
  );

  const journalUid = navigation.getParam('journalUid');
  const journal = journals.get(journalUid)!;

  async function memberAdd() {
    const derived = etesync.encryptionKey;

    const keyPair = userInfo.getKeyPair(userInfo.getCryptoManager(derived));
    const cryptoManager = journal.getCryptoManager(derived, keyPair);

    const pubkeyBytes = sjcl.codec.bytes.fromBits(sjcl.codec.base64.toBits(publicKey));
    const encryptedKey = sjcl.codec.base64.fromBits(sjcl.codec.bytes.toBits(cryptoManager.getEncryptedKey(keyPair, pubkeyBytes)));

    const journalMembersManager = new EteSync.JournalMembersManager(etesync.credentials, etesync.serviceApiUrl, journal.uid);
    await journalMembersManager.create({ user: username, key: encryptedKey, readOnly }).then(() => {
      navigation.goBack();
    }).catch((e) => {
      setErrorUsername(e.toString());
    });
  }

  async function memberPubkeyGet() {
    const userInfoManager = new EteSync.UserInfoManager(etesync.credentials, etesync.serviceApiUrl);
    const newUserInfo = await userInfoManager.fetch(username);
    return newUserInfo.publicKey;
  }

  return (
    <React.Fragment>
      <Appbar.Action
        icon="account-plus"
        onPress={() => {
          setMemberDialogVisible(true);
        }}
      />
      <ConfirmationDialog
        title="Verify security fingerprint"
        visible={!!publicKey}
        onOk={async () => {
          await memberAdd();
          navigation.goBack();
        }}
        onCancel={() => {
          setPublicKey('');
          setMemberDialogVisible(false);
        }}
      >
        <>
          <Paragraph>
            Verify {username}'s security fingerprint to ensure the encryption is secure.
          </Paragraph>
          { publicKey &&
            <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 15 }}>
              <PrettyFingerprint publicKey={publicKey} />
            </View>
          }
        </>
      </ConfirmationDialog>
      { memberDialogVisible &&
        <ConfirmationDialog
          title="Add Member"
          visible={memberDialogVisible && !publicKey}
          onOk={async () => {
            const ret = await memberPubkeyGet();
            setPublicKey(ret);
            return ret;
          }}
          onCancel={() => {
            setMemberDialogVisible(false);
          }}
        >
          <>
            <TextInput
              keyboardType={'email-address'}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              error={!!errorUsername}
              onChangeText={setUsername}
              label="Username"
              value={username}
            />
            <HelperText
              type="error"
              error={!!errorUsername}
            >
              {errorUsername}
            </HelperText>
            <Checkbox
              title="Read only?"
              status={readOnly}
              onPress={() => { setReadOnly(!readOnly) }}
            />
          </>
        </ConfirmationDialog>
      }
    </React.Fragment>
  );
}

JournalMembersScreen.navigationOptions = {
  title: 'Collection Members',
  rightAction: (<RightAction />),
};

export default JournalMembersScreen;
