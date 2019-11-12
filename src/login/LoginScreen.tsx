import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '../navigation/Hooks';

import { View } from 'react-native';
import { Headline, Subheading, Paragraph, Text } from 'react-native-paper';
import { NavigationScreenComponent } from 'react-navigation';

import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import Container from '../widgets/Container';
import LoadingIndicator from '../widgets/LoadingIndicator';
import ErrorOrLoadingDialog from '../widgets/ErrorOrLoadingDialog';
import LoginForm from '../components/LoginForm';
import EncryptionLoginForm from '../components/EncryptionLoginForm';

import { store, StoreState } from '../store';

import { fetchUserInfo, deriveKey, fetchCredentials } from '../store/actions';
import { useLoading, startTask } from '../helpers';

import * as C from '../constants';


function EncryptionPart(props: { onEncryptionFormSubmit: (encryptionPassword: string) => void }) {
  const credentials = useSelector((state: StoreState) => state.credentials);
  const [fetched, setFetched] = React.useState(false);
  const [isNewUser, setIsNewUser] = React.useState(false);

  React.useEffect(() => {
    // FIXME: verify the error is a 404
    store.dispatch<any>(fetchUserInfo(credentials, credentials.credentials.email)).catch(() => {
      setIsNewUser(true);
    }).finally(() => {
      setFetched(true);
    });
  }, [credentials]);

  if (!fetched) {
    return <LoadingIndicator />;
  }


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
        onSubmit={props.onEncryptionFormSubmit}
      />
    </Container>
  );
}

const LoginScreen: NavigationScreenComponent = React.memo(function _LoginScreen() {
  const credentials = useSelector((state: StoreState) => state.credentials.credentials);
  const encryptionKey = useSelector((state: StoreState) => state.encryptionKey.key);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [loading, error, setPromise] = useLoading();

  function onFormSubmit(username: string, password: string, serviceApiUrl?: string) {
    serviceApiUrl = serviceApiUrl ? serviceApiUrl : C.serviceApiBase;
    setPromise(dispatch<any>(fetchCredentials(username, password, serviceApiUrl)));
  }

  function onEncryptionFormSubmit(encryptionPassword: string) {
    setPromise(startTask(() => {
      dispatch(deriveKey(credentials!.email, encryptionPassword));
      navigation.navigate('App');
    }));
  }

  let screenContent: React.ReactNode;
  if (!credentials) {
    screenContent = (
      <Container>
        <Headline>Please Log In</Headline>
        <LoginForm
          onSubmit={onFormSubmit}
        />
      </Container>
    );
  } else if (!encryptionKey) {
    screenContent = (
      <EncryptionPart onEncryptionFormSubmit={onEncryptionFormSubmit} />
    );
  }

  if (screenContent) {
    return (
      <KeyboardAwareScrollView>
        {screenContent}
        <ErrorOrLoadingDialog
          loading={loading}
          error={error}
          onDismiss={() => setPromise(undefined)}
        />
      </KeyboardAwareScrollView>
    );
  }

  return <React.Fragment />;
});

LoginScreen.navigationOptions = {
  showMenuButton: true,
};

export default LoginScreen;
