import * as React from 'react';
import { useSelector } from 'react-redux';
import { ScrollView } from 'react-native';

import { StoreState } from './store';

import PrettyError from './PrettyError';

function ErrorBoundaryInner(props: any) {
  const errors = useSelector((state: StoreState) => state.errors);
  const error = props.error ?? errors.first(null);
  if (error) {
    // tslint:disable-next-line:no-console
    console.error(error);
    return (
      <ScrollView>
        <PrettyError error={error} />
      </ScrollView>
    );
  }
  return props.children;
}

interface PropsType {
  children: React.ReactNode | React.ReactNode[];
}

class ErrorBoundary extends React.Component<PropsType> {
  public state: {
    error?: Error;
  };

  constructor(props: PropsType) {
    super(props);
    this.state = { };
  }

  public componentDidCatch(error: Error) {
    this.setState({ error });
  }

  public render() {
    return (
      <ErrorBoundaryInner error={this.state.error}>
        {this.props.children}
      </ErrorBoundaryInner>
    );
  }
}

export default ErrorBoundary;
