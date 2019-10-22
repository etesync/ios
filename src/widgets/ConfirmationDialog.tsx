import * as React from 'react';
import { Keyboard } from 'react-native';
import { Portal, Dialog, Button } from 'react-native-paper';

interface PropsType {
  title: string;
  children: React.ReactNode | React.ReactNode[];
  visible: boolean;
  onCancel?: () => void;
  onOk?: () => void;
  labelCancel?: string;
  labelOk?: string;
}

export default React.memo(function ConfirmationDialog(props: PropsType) {
  const labelCancel = props.labelCancel || 'Cancel';
  const labelOk = props.labelOk || 'OK';

  React.useMemo(() => {
    Keyboard.dismiss();
  }, [props.visible]);

  return (
    <Portal>
      <Dialog
        visible={props.visible}
        onDismiss={props.onCancel}
      >
        <Dialog.Title>{props.title}</Dialog.Title>
        <Dialog.Content>
          {props.children}
        </Dialog.Content>
        <Dialog.Actions>
          {props.onCancel &&
            <Button onPress={props.onCancel}>{labelCancel}</Button>
          }
          {props.onOk &&
            <Button onPress={props.onOk}>{labelOk}</Button>
          }
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});
