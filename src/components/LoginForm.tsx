import * as React from 'react';

import { Text, View } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';

import ExternalLink from '../widgets/ExternalLink';

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

  handleInputChange(name: string) {
    return (value: string) => {
      this.setState({
        [name]: value
      });
    };
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
        <>
          <TextInput
            keyboardType="url"
            textContentType="URL"
            error={!!this.state.errors.errorServer}
            value={this.state.server}
            onChangeText={this.handleInputChange('server')}
          />
          <HelperText
            type="error"
            visible={!!this.state.errors.errorServer}
          >
            {this.state.errors.errorServer}
          </HelperText>
        </>
      );
    }

    return (
      <>
        {(this.props.error) && (<Text>Error! {this.props.error.message}</Text>)}
        <View>
          <TextInput
            keyboardType={this.state.showAdvanced ? 'default' : "email-address" }
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="next"
            error={!!this.state.errors.errorEmail}
            onChangeText={this.handleInputChange('username')}
            label="Username"
            value={this.state.username}
          />
          <HelperText
            type="error"
            visible={!!this.state.errors.errorEmail}
          >
            {this.state.errors.errorEmail}
          </HelperText>

          <TextInput
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            error={!!this.state.errors.errorPassword}
            label="Password"
            value={this.state.password}
            onChangeText={this.handleInputChange('password')}
          />
          <HelperText
            type="error"
            visible={!!this.state.errors.errorPassword}
          >
            {this.state.errors.errorPassword}
          </HelperText>
          <ExternalLink href={C.forgotPassword}>
            <Text>Forget password?</Text>
          </ExternalLink>

          <TextInput
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            error={!!this.state.errors.errorEncryptionPassword}
            // helperText={this.state.errors.errorEncryptionPassword || 'Choose a new one if not already set'}
            value={this.state.encryptionPassword}
            onChangeText={this.handleInputChange('encryptionPassword')}
          />
          <HelperText
            type="error"
            visible={!!this.state.errors.errorEncryptionPassword}
          >
            {this.state.errors.errorEncryptionPassword || 'Choose a new one if not already set'}
          </HelperText>

          {advancedSettings}

          <Button
            mode="contained"
            color="secondary"
            disabled={this.props.loading}
            onPress={this.generateEncryption}
          >
            <Text>{this.props.loading ? 'Loading…' : 'Log In'}</Text>
          </Button>
        </View>
      </>
    );
  }
}

export default LoginForm;

