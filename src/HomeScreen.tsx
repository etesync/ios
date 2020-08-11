// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Appbar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";

import { SyncManager } from "./sync/SyncManager";

import JournalListScreen from "./components/JournalListScreen";
import { usePermissions } from "./Permissions";

import { StoreState } from "./store";
import { performSync } from "./store/actions";

import { useCredentials } from "./credentials";
import { registerSyncTask } from "./sync/SyncManager";


export default React.memo(function HomeScreen() {
  const etebase = useCredentials()!;
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const syncCount = useSelector((state: StoreState) => state.syncCount);
  const permissionsStatus = usePermissions();

  React.useEffect(() => {
    if (etebase && !permissionsStatus) {
      registerSyncTask(etebase.user.username);
    }
  }, [etebase, !permissionsStatus]);

  function refresh() {
    const syncManager = SyncManager.getManager(etebase);
    dispatch(performSync(syncManager.sync()));
  }

  navigation.setOptions({
    headerRight: () => (
      <Appbar.Action icon="refresh" accessibilityLabel="Synchronize" disabled={!etebase || syncCount > 0} onPress={refresh} />
    ),
  });

  if (permissionsStatus) {
    return permissionsStatus;
  }

  return (
    <JournalListScreen />
  );
});
