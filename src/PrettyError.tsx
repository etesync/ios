import * as React from 'react';

import { View } from 'react-native';
import { Text } from 'react-native-paper';

export const PrettyError = (props: any) => (
  <View>
    <Text>Something went wrong!</Text>
    <Text>{props.error.message}</Text>
    <Text>{props.error.stack}</Text>
  </View>
);

export default PrettyError;
