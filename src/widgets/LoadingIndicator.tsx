import * as React from 'react';
import { ActivityIndicator } from 'react-native-paper';

export default function LoadingIndicator(_props: any) {
  const { style, ...props } = _props;
  return (
    <ActivityIndicator animating size="large" style={{ margin: 15, ...style }} {...props} />
  );
}
