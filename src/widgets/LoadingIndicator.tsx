import * as React from 'react';
import { ActivityIndicator } from 'react-native-paper';

import Container from './Container';

export default function LoadingIndicator(_props: any) {
  const { style, ...props } = _props;
  return (
    <Container style={{ flexGrow: 1 }}>
      <ActivityIndicator animating size="large" style={{ margin: 15, ...style }} {...props} />
    </Container>
  );
}
