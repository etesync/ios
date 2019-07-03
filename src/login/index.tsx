import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';

import * as store from '../store';

const credentialsSelector = createSelector(
  (state: store.StoreState) => state.credentials.value,
  (state: store.StoreState) => state.credentials.error,
  (state: store.StoreState) => state.credentials.fetching,
  (state: store.StoreState) => state.encryptionKey.key,
  (value, error, fetching, encryptionKey) => {
    if (value === null) {
      return {value, error, fetching};
    }

    return {
      error,
      fetching,
      value: {
        ...value,
        encryptionKey,
      },
    } as store.CredentialsType;
  }
);

export function useCredentials() {
  // FIXME: why is the cast needed?
  return useSelector(credentialsSelector) as store.CredentialsType;
}
