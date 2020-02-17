import * as React from 'react';
import { TextInput as PaperTextInput } from 'react-native-paper';

export default React.memo(React.forwardRef(function PasswordInput(inProps: React.ComponentPropsWithoutRef<typeof PaperTextInput>, ref) {
  const {
    style,
    ...props
  } = inProps;

  return (
    <PaperTextInput
      ref={ref as any}
      style={[{ backgroundColor: 'transparent' }, style]}
      {...props}
    />
  );
}));
