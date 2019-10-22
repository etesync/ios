import * as React from 'react';

import { Text } from 'react-native-paper';

import Container from './widgets/Container';

export const PrettyError = (props: any) => (
  <Container>
    <Text>Something went wrong!</Text>
    <Text>{props.error.message}</Text>
    <Text>{props.error.stack}</Text>
  </Container>
);

export default PrettyError;
