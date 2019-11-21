import * as React from 'react';
import { ViewProps, View } from 'react-native';

export default function Container(props: React.PropsWithChildren<ViewProps>) {
  const { children, style } = props;

  return (
    <View style={{ padding: 15, ...(style as any) }}>
      {children}
    </View>
  );
}
