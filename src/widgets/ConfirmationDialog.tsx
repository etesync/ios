import * as React from 'react';
import { Keyboard } from 'react-native';
import { Portal, Dialog, Button, ProgressBar, Paragraph } from 'react-native-paper';

interface PropsType {
  title: string;
  children: React.ReactNode | React.ReactNode[];
  visible: boolean;
  onCancel?: () => void;
  onOk?: () => void | Promise<any>;
  labelCancel?: string;
  labelOk?: string;
}

export default React.memo(function ConfirmationDialog(props: PropsType) {
  const [loading, setLoading] = React.useState(false);
  const labelCancel = props.labelCancel || 'Cancel';
  const labelOk = props.labelOk || 'OK';

  React.useMemo(() => {
    Keyboard.dismiss();
  }, [props.visible]);

  function onOk() {
    const ret = props.onOk();
    if (ret && ret.then) {
      // If it's a promise, we update the loading state based on it.
      setLoading(true);
    }
  }

  return (
    <Portal>
      <Dialog
        visible={props.visible}
        onDismiss={props.onCancel}
      >
        <Dialog.Title>{props.title}</Dialog.Title>
        <Dialog.Content>
          { (loading) ?
            <>
              <Paragraph>Loading...</Paragraph>
              <ProgressBar indeterminate />
            </> :
            props.children
          }
        </Dialog.Content>
        <Dialog.Actions>
          {props.onCancel &&
            <Button disabled={loading} onPress={props.onCancel}>{labelCancel}</Button>
          }
          {props.onOk &&
            <Button disabled={loading} onPress={onOk}>{labelOk}</Button>
          }
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});
