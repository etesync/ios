import * as React from 'react';
import { View } from 'react-native';
import { IconButton, TextInput } from 'react-native-paper';

const PasswordInput = React.memo(function _PasswordInput(inProps: React.ComponentPropsWithoutRef<typeof TextInput>) {
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
        {...props}
      />
      <IconButton
        style={{ position: 'absolute', top: 15, right: 5 }}
        icon={(isPassword) ? 'eye-off' : 'eye'}
        onPress={() => setIsPassword(!isPassword)}
      />
    </View>
  );
});

export default PasswordInput;
