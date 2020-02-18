import { shallowEqual, useSelector } from 'react-redux';
import { createSelector } from 'reselect';

import * as store from '../store';

export const remoteCredentialsSelector = createSelector(
  (state: store.StoreState) => state.credentials.credentials ?? state.legacyCredentials.credentials,
  (state: store.StoreState) => state.credentials.serviceApiUrl ?? state.legacyCredentials.serviceApiUrl,
  (credentials, serviceApiUrl) => {
    if (!credentials) {
      return null;
    }

    const ret: store.CredentialsDataRemote = {
      credentials,
      serviceApiUrl,
    };
    return ret;
  }
);

export function useRemoteCredentials() {
  return useSelector(remoteCredentialsSelector, shallowEqual);
}

export const credentialsSelector = createSelector(
  (state: store.StoreState) => remoteCredentialsSelector(state),
  (state: store.StoreState) => state.encryptionKey.encryptionKey ?? state.legacyEncryptionKey.key,
  (remoteCredentials, encryptionKey) => {
    if (!remoteCredentials || !encryptionKey) {
      return null;
    }

    const ret: store.CredentialsData = {
      ...remoteCredentials,
      encryptionKey,
    };
    return ret;
  }
);

export function useCredentials() {
  return useSelector(credentialsSelector, shallowEqual);
}
