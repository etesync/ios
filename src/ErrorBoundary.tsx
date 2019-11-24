import * as React from 'react';
import { useSelector } from 'react-redux';
import { View, Linking } from 'react-native';
import { Button, Title, Text } from 'react-native-paper';

import { Updates } from 'expo';

import { StoreState } from './store';

import ScrollView from './widgets/ScrollView';
import { logger } from './logging';
import Container from './widgets/Container';
import { expo } from '../app.json';
import * as C from './constants';

function emailDevelopers(error: Error) {
  const subject = encodeURIComponent('EteSync iOS: Crash Report');
  const bodyJson = {
    version: expo.version,
    error: {
      message: error.message,
      stack: error.stack?.toString(),
    },
  };
  const body = encodeURIComponent(JSON.stringify(bodyJson));
  Linking.openURL(`mailto:${C.reportsEmail}?subject=${subject}&body=${body}`);
}

function ErrorBoundaryInner(props: React.PropsWithChildren<{ error: Error | undefined }>) {
  const errors = useSelector((state: StoreState) => state.errors);
  const error = props.error ?? errors.first(null);
  if (error) {
    logger.critical(error);
    return (
      <ScrollView>
        <Container>
          <Title>Something went wrong!</Title>
          <View style={{ marginVertical: 20, flexDirection: 'row', justifyContent: 'space-evenly' }}>
            <Button mode="contained" onPress={() => emailDevelopers(error)}>Report Bug</Button>
            <Button mode="contained" onPress={() => Updates.reloadFromCache()}>Reload App</Button>
          </View>
          <Text selectable>{error.message}</Text>
          <Text selectable>{error.stack}</Text>
        </Container>
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
