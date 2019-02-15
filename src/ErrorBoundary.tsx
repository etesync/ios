import * as React from 'react';

import PrettyError from './PrettyError';

class ErrorBoundary extends React.Component {
  state: {
    error?: Error;
  };

  constructor(props: any) {
    super(props);
    this.state = { };
  }

  componentDidCatch(error: Error) {
    this.setState({ error });
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <PrettyError error={this.state.error} />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
