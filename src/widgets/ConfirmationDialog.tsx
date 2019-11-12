import * as React from 'react';
import { Keyboard } from 'react-native';
import { Portal, Dialog, Button, ProgressBar, Paragraph } from 'react-native-paper';

import { isPromise } from '../helpers';

interface PropsType {
  title: string;
  children: React.ReactNode | React.ReactNode[];
  visible: boolean;
  dismissable?: boolean;
  onCancel?: () => void;
  onOk?: () => void | Promise<any>;
  labelCancel?: string;
  labelOk?: string;
  loading?: boolean;
  loadingText?: string;
}

export default React.memo(function ConfirmationDialog(props: PropsType) {
  const [loading, setLoading] = React.useState(props.loading ?? false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const labelCancel = props.labelCancel ?? 'Cancel';
  const labelOk = props.labelOk ?? 'OK';
  const loadingText = props.loadingText ?? 'Loading...';

  React.useEffect(() => {
    Keyboard.dismiss();
  }, [props.visible]);

  function onOk() {
    const ret = props.onOk?.();
    if (isPromise(ret)) {
      // If it's a promise, we update the loading state based on it.
      setLoading(true);
      ret.catch((e) => {
        setError(e.toString());
      }).finally(() => {
        setLoading(false);
      });
    }
  }

  let content: React.ReactNode | React.ReactNode[];
  if (error !== undefined) {
    content = (
      <Paragraph>Error: {error.toString()}</Paragraph>
    );
  } else if (loading) {
    content = (
      <>
        <Paragraph>{loadingText}</Paragraph>
        <ProgressBar indeterminate />
      </>
    );
  } else {
    content = props.children;
  }

  return (
    <Portal>
      <Dialog
        visible={props.visible}
        onDismiss={props.onCancel}
        dismissable={props.dismissable && !loading}
      >
        <Dialog.Title>{props.title}</Dialog.Title>
        <Dialog.Content>
          {content}
        </Dialog.Content>
        <Dialog.Actions>
          {props.onCancel &&
            <Button disabled={loading} onPress={props.onCancel}>{labelCancel}</Button>
          }
          {!error && props.onOk &&
            <Button disabled={loading} onPress={onOk}>{labelOk}</Button>
          }
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});
