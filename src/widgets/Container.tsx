import * as React from 'react';
import { ViewProps, View } from 'react-native';

class Container extends React.Component<ViewProps> {

  constructor(props: any) {
    super(props);
  }

  public render() {
    const { children, style } = this.props;

    return (
      <View style={style}>
        {children}
      </View>
    );
  }
}

export default Container;
