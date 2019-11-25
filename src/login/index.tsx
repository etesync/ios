import { shallowEqual, useSelector } from 'react-redux';
import { createSelector } from 'reselect';

import * as store from '../store';

const credentialsSelector = createSelector(
  (state: store.StoreState) => state.credentials.credentials,
  (state: store.StoreState) => state.credentials.serviceApiUrl,
  (state: store.StoreState) => state.encryptionKey.key,
  (credentials, serviceApiUrl, encryptionKey) => {
    if (!credentials || !encryptionKey) {
      return null;
    }

    const ret: store.CredentialsData = {
      credentials,
      serviceApiUrl,
      encryptionKey,
    };
    return ret;
  }
);

export function useCredentials() {
  return useSelector(credentialsSelector, shallowEqual);
}
