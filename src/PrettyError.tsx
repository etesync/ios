import * as React from 'react';
import { Container, Header, Content, Text } from 'native-base';

export const PrettyError = (props: any) => (
  <Container>
    <Header />
    <Content>
      <Text>Something went wrong!</Text>
      <Text>{props.error.message}</Text>
      <Text>{props.error.stack}</Text>
    </Content>
  </Container>
);

export default PrettyError;
