import * as React from 'react';
import { TextInput as PaperTextInput, useTheme } from 'react-native-paper';

export default React.memo(React.forwardRef(function PasswordInput(inProps: React.ComponentPropsWithoutRef<typeof PaperTextInput>, ref) {
  const theme = useTheme();
  const {
    style,
    ...props
  } = inProps;

  return (
    <PaperTextInput
      ref={ref as any}
      style={[{ backgroundColor: 'transparent' }, style]}
      theme={{ colors: { primary: theme.colors.placeholder } }}
      {...props}
    />
  );
}));
