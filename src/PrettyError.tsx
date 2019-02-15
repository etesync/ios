import * as React from 'react';

export const PrettyError = (props: any) => (
  <div>
    <h2>Something went wrong!</h2>
    <pre>
      {props.error.message}
    </pre>

    <h3>Stack trace:</h3>
    <pre>
      {props.error.stack}
    </pre>
  </div>
);

export default PrettyError;
