import * as React from 'react';

import { Headline, Paragraph, Text } from 'react-native-paper';

import Container from './widgets/Container';
// import SyncGate from './SyncGate';
const SyncGate = (props: any) => <Text>SyncGate</Text>;
import LoginForm from './components/LoginForm';
// import EncryptionLoginForm from './components/EncryptionLoginForm';
const EncryptionLoginForm = (props: any) => <Text>EncryptionLoginForm</Text>;

import { store, CredentialsType } from './store';
import { login, deriveKey } from './store/actions';

import * as C from './constants';

class LoginGate extends React.Component {
  public props: {
    credentials: CredentialsType;
  };

  constructor(props: any) {
    super(props);
    this.onFormSubmit = this.onFormSubmit.bind(this);
    this.onEncryptionFormSubmit = this.onEncryptionFormSubmit.bind(this);
  }

  public onFormSubmit(username: string, password: string, encryptionPassword: string, serviceApiUrl?: string) {
    serviceApiUrl = serviceApiUrl ? serviceApiUrl : C.serviceApiBase;
    store.dispatch<any>(login(username, password, encryptionPassword, serviceApiUrl));
  }

  public onEncryptionFormSubmit(encryptionPassword: string) {
    store.dispatch(deriveKey(this.props.credentials.value!.credentials.email, encryptionPassword));
  }

  public render() {
    if (this.props.credentials.value === null) {
      return (
        <Container>
          <Headline>Please Log In</Headline>
          <LoginForm
            onSubmit={this.onFormSubmit}
            error={this.props.credentials.error}
            loading={this.props.credentials.fetching}
          />
        </Container>
      );
    } else if (this.props.credentials.value.encryptionKey === null) {
      return (
        <Container>
          <Headline>Encryption Password</Headline>
          <Paragraph>
            You are logged in as <Text style={{fontWeight: 'bold'}}>{this.props.credentials.value.credentials.email}</Text>.
            Please enter your encryption password to continue, or log out from the side menu.
          </Paragraph>
          <EncryptionLoginForm
            onSubmit={this.onEncryptionFormSubmit}
          />
        </Container>
      );
    }

    return (
      <SyncGate etesync={this.props.credentials.value} />
    );
  }
}

export default LoginGate;
