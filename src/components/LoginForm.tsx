import * as React from 'react';

import { Button, Text, Form, Item, Label } from 'native-base';
import Input from '../widgets/Input';

import * as C from '../constants';

interface FormErrors {
  errorEmail?: string;
  errorPassword?: string;
  errorEncryptionPassword?: string;
  errorServer?: string;
}

class LoginForm extends React.PureComponent {
  state: {
    showAdvanced: boolean;
    errors: FormErrors;

    server: string;
    username: string;
    password: string;
    encryptionPassword: string;
  };

  props: {
    onSubmit: (username: string, password: string, encryptionPassword: string, serviceApiUrl?: string) => void;
    loading?: boolean;
    error?: Error;
  };

  constructor(props: any) {
    super(props);
    this.state = {
      showAdvanced: false,
      errors: {},
      server: '',
      username: '',
      password: '',
      encryptionPassword: '',
    };
    this.generateEncryption = this.generateEncryption.bind(this);
    this.toggleAdvancedSettings = this.toggleAdvancedSettings.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  handleInputChange(name: string, value: string) {
    this.setState({
      [name]: value
    });
  }

  generateEncryption(e: any) {
    e.preventDefault();
    const server = this.state.showAdvanced ? this.state.server : undefined;

    const username = this.state.username;
    const password = this.state.password;
    const encryptionPassword = this.state.encryptionPassword;

    let errors: FormErrors = {};
    const fieldRequired = 'This field is required!';
    if (!username) {
      errors.errorEmail = fieldRequired;
    }
    if (!password) {
      errors.errorPassword = fieldRequired;
    }
    if (!encryptionPassword) {
      errors.errorEncryptionPassword = fieldRequired;
    }

    if (process.env.NODE_ENV !== 'development') {
      if (this.state.showAdvanced && !this.state.server.startsWith('https://')) {
        errors.errorServer = 'Server URI must start with https://';
      }
    }

    if (Object.keys(errors).length) {
      this.setState({errors: errors});
      return;
    } else {
      this.setState({errors: {}});
    }

    this.props.onSubmit(username, password, encryptionPassword, server);
  }

  toggleAdvancedSettings() {
    this.setState({showAdvanced: !this.state.showAdvanced});
  }

  render() {
    let advancedSettings = null;
    if (this.state.showAdvanced) {
      advancedSettings = (
        <Item stackedLabel>
          <Label>Server</Label>
          <Input
            keyboardType="url"
            textContentType="URL"
            // error={!!this.state.errors.errorServer}
            // helperText={this.state.errors.errorServer}
            name="server"
            value={this.state.server}
            onNamedChange={this.handleInputChange}
          />
            </Item>
            );
    }

    return (
      <>
        {(this.props.error) && (<Text>Error! {this.props.error.message}</Text>)}
        <Form>
          <Item stackedLabel>
            <Label>Username</Label>
            <Input
              keyboardType={this.state.showAdvanced ? 'default' : "email-address" }
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
              // error={!!this.state.errors.errorEmail}
              // helperText={this.state.errors.errorEmail}
              name="username"
              label="Username"
              value={this.state.username}
              onNamedChange={this.handleInputChange}
            />
          </Item>
          <Item stackedLabel>
            <Label>Password</Label>
            <Input
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              // error={!!this.state.errors.errorPassword}
              // helperText={this.state.errors.errorPassword}
              label="Password"
              name="password"
              value={this.state.password}
              onNamedChange={this.handleInputChange}
            />
          </Item>
          <Item stackedLabel>
            <Label>Encryption Password</Label>
            <Input
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              // error={!!this.state.errors.errorEncryptionPassword}
              // helperText={this.state.errors.errorEncryptionPassword || 'Choose a new one if not already set'}
              name="encryptionPassword"
              value={this.state.encryptionPassword}
              onNamedChange={this.handleInputChange}
            />
          </Item>
          {advancedSettings}

          <Button
            color="secondary"
            disabled={this.props.loading}
          >
            <Text>{this.props.loading ? 'Loading…' : 'Log In'}</Text>
          </Button>
        </Form>
      </>
    );
  }
}

export default LoginForm;

