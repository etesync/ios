import * as React from 'react';
import { ViewProps } from 'react-native';
import { Menu } from 'react-native-paper';

interface PropsType extends ViewProps {
  visible: boolean;
  anchor: React.ReactNode;
  options: string[];
  onChange: (index: number) => void;
  onDismiss: () => void;
}

export default function Select(inProps: React.PropsWithChildren<PropsType>) {
  const { visible, anchor, options, onDismiss, onChange, ...props } = inProps;

  return (
    <Menu
      visible={visible}
      onDismiss={onDismiss}
      anchor={anchor}
      {...props}
    >
      {options.map((item, idx) => (
        <Menu.Item key={idx} onPress={() => onChange(idx)} title={item} />
      ))}
    </Menu>
  );
}
