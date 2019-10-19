import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';

import * as store from '../store';

const credentialsSelector = createSelector(
  (state: store.StoreState) => state.credentials,
  (state: store.StoreState) => state.encryptionKey.key,
  (credentials, encryptionKey) => {
    if (!credentials.credentials) {
      return null;
    }

    const ret: store.CredentialsData = {
      ...credentials,
      encryptionKey,
    };
    return ret;
  }
);

export function useCredentials() {
  return useSelector(credentialsSelector);
}
