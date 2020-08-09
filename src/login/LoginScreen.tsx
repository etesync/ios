// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Action } from "redux-actions";
import { useDispatch, useSelector } from "react-redux";

import { View } from "react-native";
import { Paragraph, Text } from "react-native-paper";

import * as EteSync from "etesync";
import sjcl from "sjcl";

import { Subheading, Headline } from "../widgets/Typography";
import ScrollView from "../widgets/ScrollView";
import Container from "../widgets/Container";
import LoadingIndicator from "../widgets/LoadingIndicator";
import ErrorOrLoadingDialog from "../widgets/ErrorOrLoadingDialog";
import LoginForm from "../components/LoginForm";
import EncryptionLoginForm from "../components/EncryptionLoginForm";
import WebviewKeygen from "../components/WebviewKeygen";

import { store, StoreState } from "../store";

import { fetchUserInfo, deriveKey, fetchCredentials, createUserInfo, performSync } from "../store/actions";
import { useLoading, startTask } from "../helpers";

import { SyncManager } from "../sync/SyncManager";
import { credentialsSelector } from ".";

import * as C from "../constants";

function b64ToBa(b64: string) {
  return sjcl.codec.bytes.fromBits(sjcl.codec.base64.toBits(b64));
}

interface KeyGenPropsType {
  derived: string;
  onFinish: () => void;
}

function KeyGen(props: KeyGenPropsType) {
  const credentials = useSelector((state: StoreState) => state.credentials)!;
  const derived = props.derived;

  return (
    <>
      <LoadingIndicator />
      <WebviewKeygen
        onFinish={async (keys) => {
          if (keys.error) {
            throw new Error(keys.error);
          } else {
            const userInfo = new EteSync.UserInfo(credentials.credentials.email, EteSync.CURRENT_VERSION);
            const keyPair = new EteSync.AsymmetricKeyPair(b64ToBa(keys.publicKey), b64ToBa(keys.privateKey));
            const cryptoManager = userInfo.getCryptoManager(derived);

            userInfo.setKeyPair(cryptoManager, keyPair);

            await store.dispatch(createUserInfo({ ...credentials, encryptionKey: derived }, userInfo));
            props.onFinish();
          }
        }}
      />
    </>
  );
}

function EncryptionPart() {
  const credentials = useSelector((state: StoreState) => state.credentials)!;
  const [fetched, setFetched] = React.useState(false);
  const [derived, setDerived] = React.useState<Action<string>>();
  const [userInfo, setUserInfo] = React.useState<EteSync.UserInfo>();
  const dispatch = useDispatch();
  const [loading, error, setPromise] = useLoading();

  React.useEffect(() => {
    setPromise(async () => {
      try {
        const fetchedUserInfo = fetchUserInfo(credentials, credentials.credentials.email);
        store.dispatch(fetchedUserInfo);
        setUserInfo(await fetchedUserInfo.payload);
      } catch (e) {
        if (!(e instanceof EteSync.HTTPError && (e.status === 404))) {
          throw e;
        }
      } finally {
        setFetched(true);
      }
    });
  }, [credentials]);

  if (!fetched) {
    return <LoadingIndicator />;
  }

  if (derived) {
    const done = () => {
      dispatch(derived);
      const etesync = credentialsSelector(store.getState() as StoreState);
      const syncManager = SyncManager.getManager(etesync!);
      dispatch(performSync(startTask(() => syncManager.sync(), 200)));
    };

    if (userInfo) {
      startTask(done);
      return <React.Fragment />;
    } else {
      return (
        <KeyGen derived={derived.payload} onFinish={done} />
      );
    }
  }

  function onEncryptionFormSubmit(encryptionPassword: string) {
    setPromise(async () => {
      const derivedAction = deriveKey(credentials.credentials.email, encryptionPassword);
      if (userInfo) {
        const userInfoCryptoManager = userInfo.getCryptoManager(await derivedAction.payload);
        try {
          userInfo.verify(userInfoCryptoManager);
        } catch (e) {
          throw new EteSync.EncryptionPasswordError("Wrong encryption password");
        }
      }

      setDerived({ ...derivedAction, payload: await derivedAction.payload } as any);
    });
  }

  const isNewUser = !userInfo;

  return (
    <Container>
      <Headline>Encryption Password</Headline>
      {(isNewUser) ?
        <View>
          <Subheading>Welcome to EteSync!</Subheading>
          <Paragraph>
            Please set your encryption password below, and make sure you got it right, as it can't be recovered if lost!
          </Paragraph>
        </View>
        :
        <Paragraph>
          You are logged in as <Text style={{ fontWeight: "bold" }}>{credentials.credentials.email}</Text>.
          Please enter your encryption password to continue, or log out from the side menu.
        </Paragraph>
      }

      <View style={{ marginTop: 20 }} />

      <EncryptionLoginForm
        onSubmit={onEncryptionFormSubmit}
      />

      <ErrorOrLoadingDialog
        loading={loading}
        error={error}
        onDismiss={() => setPromise(undefined)}
      />
    </Container>
  );
}

const LoginScreen = React.memo(function _LoginScreen() {
  const credentials = useSelector((state: StoreState) => state.credentials.credentials ?? state.legacyCredentials.credentials);
  const encryptionKey = useSelector((state: StoreState) => state.encryptionKey.encryptionKey ?? state.legacyEncryptionKey.key);
  const dispatch = useDispatch();
  const [loading, error, setPromise] = useLoading();

  function onFormSubmit(username: string, password: string, serviceApiUrl?: string) {
    serviceApiUrl = serviceApiUrl ? serviceApiUrl : C.serviceApiBase;
    setPromise(dispatch<any>(fetchCredentials(username, password, serviceApiUrl)));
  }

  let screenContent: React.ReactNode;
  if (!credentials) {
    screenContent = (
      <Container>
        <Headline>Please Log In</Headline>
        <LoginForm
          onSubmit={onFormSubmit}
        />
        <ErrorOrLoadingDialog
          loading={loading}
          error={error}
          onDismiss={() => setPromise(undefined)}
        />
      </Container>
    );
  } else if (!encryptionKey) {
    screenContent = (
      <EncryptionPart />
    );
  }

  if (screenContent) {
    return (
      <ScrollView keyboardAware>
        {screenContent}
      </ScrollView>
    );
  }

  return <React.Fragment />;
});

export default LoginScreen;
