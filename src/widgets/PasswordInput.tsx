import * as React from 'react';
import { View } from 'react-native';
import { IconButton, TextInput } from 'react-native-paper';

const PasswordInput = React.memo(React.forwardRef(function _PasswordInput(inProps: React.ComponentPropsWithoutRef<typeof TextInput>, ref) {
  const [isPassword, setIsPassword] = React.useState(true);
  const {
    style,
    ...props
  } = inProps;

  return (
    <View style={style}>
      <TextInput
        secureTextEntry={isPassword}
        autoCapitalize="none"
        autoCorrect={false}
        ref={ref as any}
        {...props}
      />
      <IconButton
        style={{ position: 'absolute', top: 15, right: 5 }}
        icon={(isPassword) ? 'eye-off' : 'eye'}
        accessibilityLabel={(isPassword) ? 'Show password' : 'Hide password'}
        onPress={() => setIsPassword(!isPassword)}
      />
    </View>
  );
}));

export default PasswordInput;
