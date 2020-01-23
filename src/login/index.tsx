import { shallowEqual, useSelector } from 'react-redux';
import { createSelector } from 'reselect';

import * as store from '../store';

export const credentialsSelector = createSelector(
  (state: store.StoreState) => state.credentials.credentials ?? state.legacyCredentials.credentials,
  (state: store.StoreState) => state.credentials.serviceApiUrl ?? state.legacyCredentials.serviceApiUrl,
  (state: store.StoreState) => state.encryptionKey.key ?? state.legacyEncryptionKey.key,
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
