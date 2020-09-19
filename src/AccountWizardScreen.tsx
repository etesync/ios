// SPDX-FileCopyrightText: © 2017 EteSync Authors
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from "react";
import * as Etebase from "etebase";
import { View } from "react-native";
import { Button, Paragraph, Headline } from "react-native-paper";

import LoadingIndicator from "./widgets/LoadingIndicator";
import Wizard, { WizardNavigationBar, PagePropsType } from "./widgets/Wizard";

import { SyncManager } from "./sync/SyncManager";

import { store } from "./store";
import { useCredentials } from "./credentials";
import { useNavigation } from "@react-navigation/native";

const wizardPages = [
  (props: PagePropsType) => (
    <SetupCollectionsPage {...props} />
  ),
];

function SetupCollectionsPage(props: PagePropsType) {
  const etebase = useCredentials()!;
  const [error, setError] = React.useState<Error>();
  const [loading, setLoading] = React.useState(false);
  async function onNext() {
    setLoading(true);
    try {
      const colMgr = etebase.getCollectionManager();
      const types = [
        ["etebase.vcard", "My Contacts"],
        ["etebase.vevent", "My Calendar"],
        ["etebase.vtodo", "My Tasks"],
      ];
      for (const [type, name] of types) {
        const meta: Etebase.CollectionMetadata = {
          type,
          name,
        };
        const collection = await colMgr.create(meta, "");
        await colMgr.upload(collection);
      }

      const syncManager = SyncManager.getManager(etebase!);
      syncManager.sync();

      props.next?.();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const next = (loading) ? undefined : onNext;
  if (loading) {
    return (
      <LoadingIndicator />
    );
  }

  return (
    <>
      <View style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Headline style={{ textAlign: "center" }}>Setup Collections</Headline>
        <Paragraph style={{ textAlign: "center" }}>
          In order to start using EteSync you need to create collections to store your data. Clicking "Finish" below will create a default calendar, address book and a task list for you.
        </Paragraph>
        {(error) && (
          <Paragraph style={{ color: "red" }}>{error.message}</Paragraph>
        )}
      </View>
      <WizardNavigationBar {...props} next={next} />
    </>
  );
}

export default function AccountWizardScreen() {
  const [tryCount, setTryCount] = React.useState(0);
  const [ranWizard, setRanWizard] = React.useState(false);
  const [syncError, setSyncError] = React.useState<Error>();
  const etebase = useCredentials();
  const navigation = useNavigation();
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    setSyncError(undefined);
    if (!etebase) {
      return;
    }
    (async () => {
      const syncManager = SyncManager.getManager(etebase!);
      const sync = syncManager.sync();
      try {
        await sync;

        const cachedCollection = store.getState().cache2.collections;
        // XXX new account - though should change test to see if there are any PIM types
        if (cachedCollection.size > 0) {
          setRanWizard(true);
        }
      } catch (e) {
        setSyncError(e);
      }
      setLoading(false);
    })();
  }, [etebase, tryCount]);

  React.useEffect(() => {
    if (!syncError && !loading && ranWizard) {
      navigation.replace("home", undefined);
    }
  }, [ranWizard, syncError, loading]);

  if (syncError) {
    return (
      <View style={{ flexGrow: 1, justifyContent: "center", alignItems: "center" }}>
        <Headline style={{ textAlign: "center" }}>Error!</Headline>
        <Paragraph style={{ textAlign: "center" }}>
          {syncError?.message}
        </Paragraph>
        <Button
          mode="contained"
          onPress={() => setTryCount(tryCount + 1)}
        >
          Retry
        </Button>
      </View>
    );
  }

  if (loading) {
    return (<LoadingIndicator />);
  }

  if (!ranWizard) {
    return (
      <Wizard pages={wizardPages} onFinish={() => setRanWizard(true)} style={{ display: "flex", flexDirection: "column", flex: 1 }} />
    );
  }

  return (<LoadingIndicator />);
}
