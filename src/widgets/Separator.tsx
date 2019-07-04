import * as React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';

interface PropsType {
  style?: StyleProp<ViewStyle>;
}

function Separator(props: PropsType) {
  return (
    <View style={{ backgroundColor: '#E0E0E0', height: 1, ...(props.style as any) }} />
  );
}

export default Separator;
