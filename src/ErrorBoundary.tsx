// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import { View, Linking, Clipboard } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Updates } from 'expo';

import { StoreState, persistor, store } from './store';

import { Title } from './widgets/Typography';
import ScrollView from './widgets/ScrollView';
import { logger, LogLevel, getLogs } from './logging';
import Container from './widgets/Container';
import { expo } from '../app.json';
import * as C from './constants';
import { setSettings } from './store/actions';
import LogoutDialog from './LogoutDialog';
import { useCredentials } from './login';

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

function ErrorBoundaryInner(props: React.PropsWithChildren<{ error: Error | undefined }>) {
  const etesync = useCredentials();
  const [showLogout, setShowLogout] = React.useState(false);
  const errors = useSelector((state: StoreState) => state.errors);
  const error = props.error ?? errors.first(null);
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
  return <>{props.children}</>;
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
