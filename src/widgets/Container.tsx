import * as React from 'react';
import { ViewProps, View } from 'react-native';
import { useTheme } from 'react-native-paper';

export default function Container(inProps: React.PropsWithChildren<ViewProps>) {
  const { style, ...props } = inProps;
  const theme = useTheme();

  return (
    <View style={[{ padding: 15, backgroundColor: theme.colors.background }, style]} {...props} />
  );
}
