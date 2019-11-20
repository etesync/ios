import * as React from 'react';
import { Action } from 'redux-actions';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '../navigation/Hooks';

import { View } from 'react-native';
import { Headline, Subheading, Paragraph, Text } from 'react-native-paper';
import { NavigationScreenComponent } from 'react-navigation';

import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import * as EteSync from 'etesync';

import Container from '../widgets/Container';
import LoadingIndicator from '../widgets/LoadingIndicator';
import ErrorOrLoadingDialog from '../widgets/ErrorOrLoadingDialog';
import LoginForm from '../components/LoginForm';
import EncryptionLoginForm from '../components/EncryptionLoginForm';

import { store, StoreState } from '../store';

import { fetchUserInfo, deriveKey, fetchCredentials } from '../store/actions';
import { useLoading, startTask } from '../helpers';

import * as C from '../constants';


function EncryptionPart() {
  const credentials = useSelector((state: StoreState) => state.credentials)!;
  const [fetched, setFetched] = React.useState(false);
  const [userInfo, setUserInfo] = React.useState<EteSync.UserInfo>();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [loading, error, setPromise] = useLoading();

  React.useEffect(() => {
    // FIXME: verify the error is a 404
    store.dispatch<any>(fetchUserInfo(credentials, credentials.credentials.email)).then((fetchedUserInfo: Action<EteSync.UserInfo>) => {
      setUserInfo(fetchedUserInfo.payload);
    }).finally(() => {
      setFetched(true);
    });
  }, [credentials]);

  if (!fetched) {
    return <LoadingIndicator />;
  }

  function onEncryptionFormSubmit(encryptionPassword: string) {
    setPromise(startTask(() => {
      const derivedAction = deriveKey(credentials.credentials.email, encryptionPassword);
      if (userInfo) {
        const userInfoCryptoManager = userInfo.getCryptoManager(derivedAction.payload);
        try {
          userInfo.verify(userInfoCryptoManager);
        } catch (e) {
          throw new EteSync.EncryptionPasswordError('Wrong encryption password');
        }
      }
      dispatch(derivedAction);
      navigation.navigate('App');
    }));
  }

  const isNewUser = !userInfo;

  return (
    <Container>
      <Headline>Encryption Password</Headline>
      {(isNewUser) ?
        <View>
          <Subheading>Welcome to EteSync!</Subheading>
          <Paragraph>
            Please set your encryption password below, and make sure you got it right, as it can't be recovered if lost!
          </Paragraph>
        </View>
        :
        <Paragraph>
          You are logged in as <Text style={{ fontWeight: 'bold' }}>{credentials.credentials.email}</Text>.
          Please enter your encryption password to continue, or log out from the side menu.
        </Paragraph>
      }

      <EncryptionLoginForm
        onSubmit={onEncryptionFormSubmit}
      />

      <ErrorOrLoadingDialog
        loading={loading}
        error={error}
        onDismiss={() => setPromise(undefined)}
      />
    </Container>
  );
}

const LoginScreen: NavigationScreenComponent = React.memo(function _LoginScreen() {
  const credentials = useSelector((state: StoreState) => state.credentials.credentials);
  const encryptionKey = useSelector((state: StoreState) => state.encryptionKey.key);
  const dispatch = useDispatch();
  const [loading, error, setPromise] = useLoading();

  function onFormSubmit(username: string, password: string, serviceApiUrl?: string) {
    serviceApiUrl = serviceApiUrl ? serviceApiUrl : C.serviceApiBase;
    setPromise(dispatch<any>(fetchCredentials(username, password, serviceApiUrl)));
  }

  let screenContent: React.ReactNode;
  if (!credentials) {
    screenContent = (
      <Container>
        <Headline>Please Log In</Headline>
        <LoginForm
          onSubmit={onFormSubmit}
        />
        <ErrorOrLoadingDialog
          loading={loading}
          error={error}
          onDismiss={() => setPromise(undefined)}
        />
      </Container>
    );
  } else if (!encryptionKey) {
    screenContent = (
      <EncryptionPart />
    );
  }

  if (screenContent) {
    return (
      <KeyboardAwareScrollView>
        {screenContent}
      </KeyboardAwareScrollView>
    );
  }

  return <React.Fragment />;
});

LoginScreen.navigationOptions = {
  showMenuButton: true,
};

export default LoginScreen;
