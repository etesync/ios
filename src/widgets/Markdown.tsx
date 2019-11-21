import * as React from 'react';
import { Linking } from 'react-native';
import { useTheme } from 'react-native-paper';
import MarkdownDisplay from 'react-native-markdown-display';

const Markdown = React.memo(function _Markdown(props: { content: string }) {
  const theme = useTheme();

  const onLinkPress = {
    onLinkPress: (url: string) => Linking.openURL(url),
  };

  return (
    <MarkdownDisplay style={{ link: { color: theme.colors.accent, textDecorationLine: 'underline' } }} {...onLinkPress}>
      {props.content}
    </MarkdownDisplay>
  );
});

export default Markdown;

