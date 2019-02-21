import * as React from 'react';
import { ViewProps, Linking } from 'react-native';
import { Button } from 'react-native-paper';

type PropsType = {
  href: string;
} & ViewProps;

class ExternalLink extends React.PureComponent<PropsType> {
  render() {
    const { href, children, ...props } = this.props;
    return (
      <Button {...props} onPress={() => Linking.openURL(href)}>
        {children}
      </Button>
      );
  }
}

export default ExternalLink;
