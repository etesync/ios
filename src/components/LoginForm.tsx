import * as React from 'react';

import { Text, View } from 'react-native';
import { Switch, Button, HelperText, Paragraph, TextInput, TouchableRipple } from 'react-native-paper';

import ExternalLink from '../widgets/ExternalLink';
import Row from '../widgets/Row';

import * as C from '../constants';
import PasswordInput from '../widgets/PasswordInput';

interface FormErrors {
  errorEmail?: string;
  errorPassword?: string;
  errorServer?: string;
}

class LoginForm extends React.PureComponent {
  public state: {
    showAdvanced: boolean;
    errors: FormErrors;

    server: string;
    username: string;
    password: string;
  };

  public props: {
    onSubmit: (username: string, password: string, serviceApiUrl?: string) => void;
  };

  constructor(props: any) {
    super(props);
    this.state = {
      showAdvanced: false,
      errors: {},
      server: '',
      username: '',
      password: '',
    };
    this.generateEncryption = this.generateEncryption.bind(this);
    this.toggleAdvancedSettings = this.toggleAdvancedSettings.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  public handleInputChange(name: string) {
    return (value: string) => {
      this.setState({
        [name]: value,
      });
    };
  }

  public generateEncryption() {
    const server = this.state.showAdvanced ? this.state.server : undefined;

    const username = this.state.username;
    const password = this.state.password;

    const errors: FormErrors = {};
    const fieldRequired = 'This field is required!';
    if (!username) {
      errors.errorEmail = fieldRequired;
    }
    if (!password) {
      errors.errorPassword = fieldRequired;
    }

    if (process.env.NODE_ENV !== 'development') {
      if (this.state.showAdvanced && !this.state.server.startsWith('https://')) {
        errors.errorServer = 'Server URI must start with https://';
      }
    }

    this.setState({ errors });
    if (Object.keys(errors).length > 0) {
      return;
    }

    this.props.onSubmit(username, password, server);
  }

  public toggleAdvancedSettings() {
    this.setState({ showAdvanced: !this.state.showAdvanced });
  }

  public render() {
    let advancedSettings = null;
    if (this.state.showAdvanced) {
      advancedSettings = (
        <>
          <TextInput
            keyboardType="url"
            textContentType="URL"
            autoCapitalize="none"
            autoCorrect={false}
            error={!!this.state.errors.errorServer}
            label="Custom Server"
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
        <View>
          <TextInput
            keyboardType={this.state.showAdvanced ? 'default' : 'email-address'}
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

          <PasswordInput
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

          <TouchableRipple
            onPress={() =>
              this.setState((state: any) => ({
                showAdvanced: !state.showAdvanced,
              }))
            }
          >
            <Row style={{ paddingVertical: 8, justifyContent: 'space-between' }}>
              <Paragraph>Advanced settings</Paragraph>
              <View pointerEvents="none">
                <Switch value={this.state.showAdvanced} />
              </View>
            </Row>
          </TouchableRipple>

          {advancedSettings}

          <Button
            mode="contained"
            onPress={this.generateEncryption}
          >
            <Text>Log In</Text>
          </Button>
        </View>
      </>
    );
  }
}

export default LoginForm;

