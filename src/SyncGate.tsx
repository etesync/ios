// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { useSelector } from "react-redux";

import { useCredentials } from "./login";
import { useCredentials as useCredentialsEb } from "./credentials";

import LoadingIndicator from "./widgets/LoadingIndicator";

import { StoreState } from "./store";

import { syncInfoSelector } from "./SyncHandler";

export function useSyncGate() {
  const etesync = useCredentials();
  const journals = useSelector((state: StoreState) => state.cache.journals);
  const entries = useSelector((state: StoreState) => state.cache.entries);
  const userInfo = useSelector((state: StoreState) => state.cache.userInfo);
  const syncCount = useSelector((state: StoreState) => state.syncCount);
  const syncStatus = useSelector((state: StoreState) => state.syncStatus);

  if ((syncCount > 0) || !etesync || !journals || !entries || !userInfo) {
    return (<LoadingIndicator status={syncStatus} notice="* Please keep the app open while syncing" />);
  }

  syncInfoSelector({ etesync, entries, journals, userInfo });

  return null;
}

export function useSyncGateEb() {
  const etebase = useCredentialsEb();
  const syncCount = useSelector((state: StoreState) => state.syncCount);
  const syncStatus = useSelector((state: StoreState) => state.syncStatus);

  if ((syncCount > 0) || !etebase) {
    return (<LoadingIndicator status={syncStatus} notice="* Please keep the app open while syncing" />);
  }

  return null;
}
