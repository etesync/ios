// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { View, Linking, Clipboard } from 'react-native';
import { Button, Text, Paragraph, HelperText } from 'react-native-paper';

import { Updates } from 'expo';

import * as EteSync from 'etesync';

import { StoreState, persistor, store } from './store';

import { Title } from './widgets/Typography';
import ScrollView from './widgets/ScrollView';
import { logger, LogLevel, getLogs } from './logging';
import Container from './widgets/Container';
import { expo } from '../app.json';
import * as C from './constants';
import { setSettings, popNonFatalError, fetchCredentials } from './store/actions';
import LogoutDialog from './LogoutDialog';
import { useCredentials } from './login';
import ConfirmationDialog from './widgets/ConfirmationDialog';
import PasswordInput from './widgets/PasswordInput';
import ExternalLink from './widgets/ExternalLink';

function emailDevelopers(error: Error, logs: string | undefined) {
  const subject = encodeURIComponent('EteSync iOS: Crash Report');
  const bodyJson = {
    version: expo.version,
    error: {
      message: error.message,
      stack: error.stack?.toString(),
      logs,
    },
  };
  const body = encodeURIComponent(JSON.stringify(bodyJson));
  Linking.openURL(`mailto:${C.reportsEmail}?subject=${subject}&body=${body}`);
}

function SessionExpiredDialog() {
  const etesync = useCredentials()!;
  const dispatch = useDispatch();
  const [password, setPassword] = React.useState('');
  const [errorPassword, setErrorPassword] = React.useState<string>();

  return (
    <ConfirmationDialog
      title="Session expired"
      visible
      onOk={async () => {
        if (!password) {
          setErrorPassword('Password is required');
          return;
        }

        const credAction = fetchCredentials(etesync.credentials.email, password, etesync.serviceApiUrl);

        try {
          await credAction.payload;

          dispatch(credAction);

          store.dispatch(popNonFatalError(etesync!));
        } catch (e) {
          setErrorPassword(e.message);
        }
      }}
      onCancel={() => {
        store.dispatch(popNonFatalError(etesync!));
      }}
    >
      <>
        <Paragraph>
          Your login session has expired, please entry your login password:
        </Paragraph>
        <PasswordInput
          error={!!errorPassword}
          label="Password"
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
        />
        <HelperText
          type="error"
          visible={!!errorPassword}
        >
          {errorPassword}
        </HelperText>
        {!C.genericMode && (
          <>
            <ExternalLink href={C.forgotPassword}>
              <Text>Forget password?</Text>
            </ExternalLink>
          </>
        )}
      </>
    </ConfirmationDialog>
  );
}

function ErrorBoundaryInner(props: React.PropsWithChildren<{ error: Error | undefined }>) {
  const etesync = useCredentials();
  const [showLogout, setShowLogout] = React.useState(false);
  const errors = useSelector((state: StoreState) => state.errors);
  const error = props.error ?? errors.fatal?.last(undefined);
  const nonFatalError = errors.other?.last(undefined);
  const [logs, setLogs] = React.useState<string>();

  React.useEffect(() => {
    getLogs().then((value) => setLogs(value.join('\n')));
  }, []);

  const buttonStyle = { marginVertical: 5 };
  if (error) {
    logger.critical(error);
    const content = `${error.message}\n${error.stack}\n${logs}`;
    return (
      <ScrollView>
        <Container>
          <Title>Something went wrong!</Title>
          <View style={{ marginVertical: 15, flexDirection: 'row', justifyContent: 'space-evenly', flexWrap: 'wrap' }}>
            <Button mode="contained" style={buttonStyle} onPress={() => emailDevelopers(error, logs)}>Report Bug</Button>
            <Button mode="contained" style={buttonStyle} onPress={() => Clipboard.setString(content)}>Copy Text</Button>
            <Button mode="contained" style={buttonStyle} onPress={() => Updates.reloadFromCache()}>Reload App</Button>
            <Button mode="contained" style={buttonStyle} onPress={async () => {
              store.dispatch(setSettings({ logLevel: LogLevel.Debug }));
              persistor.persist();
              Updates.reloadFromCache();
            }}>Enable Logging &amp; Reload</Button>
            <Button disabled={!etesync} mode="contained" style={buttonStyle} onPress={() => setShowLogout(true)}>Logout &amp; Reload</Button>
          </View>
          <Text selectable>{content}</Text>
        </Container>
        <LogoutDialog visible={showLogout} onDismiss={(loggedOut) => {
          if (loggedOut) {
            Updates.reloadFromCache();
          }
          setShowLogout(false);
        }}
        />
      </ScrollView>
    );
  }

  let nonFatalErrorDialog;
  if (nonFatalError) {
    if ((nonFatalError instanceof EteSync.HTTPError) && (nonFatalError.status === 401)) {
      nonFatalErrorDialog = (
        <SessionExpiredDialog />
      );
    } else {
      nonFatalErrorDialog = (
        <ConfirmationDialog
          title="Error"
          visible={!!nonFatalError}
          onOk={() => {
            store.dispatch(popNonFatalError(etesync!));
          }}
        >
          <Paragraph>
            {nonFatalError?.toString()}
          </Paragraph>
        </ConfirmationDialog>
      );
    }
  }

  return <>
    {props.children}

    {nonFatalErrorDialog}
  </>;
}

interface PropsType {
  children: React.ReactNode | React.ReactNode[];
}

class ErrorBoundary extends React.Component<PropsType> {
  public state: {
    error?: Error;
  };

  constructor(props: PropsType) {
    super(props);
    this.state = { };
  }

  public componentDidCatch(error: Error) {
    this.setState({ error });
  }

  public render() {
    return (
      <ErrorBoundaryInner error={this.state.error}>
        {this.props.children}
      </ErrorBoundaryInner>
    );
  }
}

export default ErrorBoundary;
