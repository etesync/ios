import * as React from 'react';
import { View } from 'react-native';
import { Text, TextInput, HelperText, Button } from 'react-native-paper';


interface FormErrors {
  encryptionPassword?: string;
}

interface PropsType {
  onSubmit: (encryptionPassword: string) => void;
}

export default function _EncryptionLognForm(props: PropsType) {
  const [errors, setErrors] = React.useState({} as FormErrors);
  const [encryptionPassword, setEncryptionPassword] = React.useState<string>();

  function onSave() {
    const saveErrors: FormErrors = {};
    const fieldRequired = 'This field is required!';

    if (!encryptionPassword) {
      saveErrors.encryptionPassword = fieldRequired;
    }

    if (Object.keys(saveErrors).length > 0) {
      setErrors(saveErrors);
      return;
    }

    props.onSubmit(encryptionPassword!);
  }

  return (
    <View>
      <TextInput
        autoFocus
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        error={!!errors.encryptionPassword}
        label="Encryption Password"
        value={encryptionPassword}
        onChangeText={setEncryptionPassword}
      />
      <HelperText
        type="error"
        visible={!!errors.encryptionPassword}
      >
        {errors.encryptionPassword}
      </HelperText>

      <Button
        mode="contained"
        onPress={onSave}
      >
        <Text>Save</Text>
      </Button>
    </View>
  );
}
