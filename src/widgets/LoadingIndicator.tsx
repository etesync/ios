import * as React from 'react';
import { ActivityIndicator } from 'react-native-paper';

export default (props: any) => {
  return (
    <ActivityIndicator animating size="large" {...props} />
  );
};
