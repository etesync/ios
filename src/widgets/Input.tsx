import * as React from 'react';
import * as RN from 'react-native';

import { NativeBase, Input as NativeInput } from 'native-base';

interface PropsType {
  name?: string;
  onNamedChange?: (name: string, text: string) => void;
}

class Input extends React.PureComponent<PropsType & NativeBase.Input> {
  constructor(props: any) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }

  render() {
    const { name, onChange, ...props } = this.props;
    return <NativeInput {...props} onChange={this.onChange} />;
  }

  private onChange(e: RN.NativeSyntheticEvent<RN.TextInputChangeEventData>) {
    this.props.onNamedChange(this.props.name, e.nativeEvent.text);
  }
}

export default Input
