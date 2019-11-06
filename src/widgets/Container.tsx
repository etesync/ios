import * as React from 'react';
import { ViewProps, View } from 'react-native';

class Container extends React.Component<ViewProps> {
  public render() {
    const { children, style } = this.props;

    return (
      <View style={{ padding: 15, ...(style as any) }}>
        {children}
      </View>
    );
  }
}

export default Container;
