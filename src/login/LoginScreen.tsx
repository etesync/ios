import * as React from 'react';
import { useDispatch } from 'react-redux';
import { useNavigation } from '../navigation/Hooks';

import { Headline, Paragraph, Text } from 'react-native-paper';
import { NavigationScreenComponent } from 'react-navigation';

import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import Container from '../widgets/Container';
import LoginForm from '../components/LoginForm';
// import EncryptionLoginForm from './components/EncryptionLoginForm';
const EncryptionLoginForm = (props: any) => <Text>EncryptionLoginForm</Text>;

import { login, deriveKey } from '../store/actions';

import * as C from '../constants';

import { useCredentials } from './';
import { store } from '../store';

const LoginScreen: NavigationScreenComponent = React.memo(function _LoginScreen() {
  const credentials = useCredentials();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [loginError, setLoginError] = React.useState(undefined as Error);
  const [loading, setLoading] = React.useState(false);

  function onFormSubmit(username: string, password: string, encryptionPassword: string, serviceApiUrl?: string) {
    serviceApiUrl = serviceApiUrl ? serviceApiUrl : C.serviceApiBase;
    setLoading(true);
    dispatch<any>(login(username, password, encryptionPassword, serviceApiUrl)).then(() => {
      setLoading(false);
      navigation.navigate('App');
    }).catch((e: any) => {
      setLoginError(e);
    });
  }

  function onEncryptionFormSubmit(encryptionPassword: string) {
    dispatch<any>(deriveKey(credentials.credentials.email, encryptionPassword)).then(() => {
      navigation.navigate('App');
    });
  }

  let screenContent: React.ReactNode;
  if (credentials === null) {
    screenContent = (
      <Container>
        <Headline>Please Log In</Headline>
        <LoginForm
          onSubmit={onFormSubmit}
          error={loginError}
          loading={loading}
        />
      </Container>
    );
  } else if (credentials.encryptionKey === null) {
    screenContent = (
      <Container>
        <Headline>Encryption Password</Headline>
        <Paragraph>
          You are logged in as <Text style={{fontWeight: 'bold'}}>{credentials.credentials.email}</Text>.
          Please enter your encryption password to continue, or log out from the side menu.
        </Paragraph>
      <EncryptionLoginForm
        onSubmit={onEncryptionFormSubmit}
      />
      </Container>
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
