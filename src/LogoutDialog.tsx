// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { List, Paragraph, Switch, useTheme } from "react-native-paper";

import { useDispatch } from "react-redux";
import { persistor } from "./store";
import { logout } from "./store/actions";

import { SyncManagerAddressBook } from "./sync/SyncManagerAddressBook";
import { SyncManagerCalendar } from "./sync/SyncManagerCalendar";
import { SyncManagerTaskList } from "./sync/SyncManagerTaskList";
import { SyncManagerAddressBook as SyncManagerAddressBookLegacy } from "./sync/legacy/SyncManagerAddressBook";
import { SyncManagerCalendar as SyncManagerCalendarLegacy } from "./sync/legacy/SyncManagerCalendar";
import { SyncManagerTaskList as SyncManagerTaskListLegacy } from "./sync/legacy/SyncManagerTaskList";
import { unregisterSyncTask, SyncManager } from "./sync/SyncManager";

import ConfirmationDialog from "./widgets/ConfirmationDialog";

import { useRemoteCredentials } from "./login";
import { CredentialsData } from "./store";

import * as C from "./constants";
import { useCredentials } from "./credentials";

export default function LogoutDialog(props: { visible: boolean, onDismiss: (loggedOut: boolean) => void }) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const etesync = useRemoteCredentials() as CredentialsData;
  const etebase = useCredentials();
  const [clearAddressBooks, setClearAddressBooks] = React.useState(true);
  const [clearCalendars, setClearCalendars] = React.useState(true);

  return (
    <ConfirmationDialog
      key={props.visible.toString()}
      title="Are you sure?"
      visible={props.visible}
      onOk={async () => {
        let error: Error | undefined;
        try {
          if (etesync) {
            const managers = [];
            if (clearAddressBooks) {
              managers.push(SyncManagerAddressBookLegacy);
            }
            if (clearCalendars) {
              managers.push(SyncManagerCalendarLegacy);
              managers.push(SyncManagerTaskListLegacy);
            }

            if (managers.length > 0) {
              const syncManager = SyncManager.getManagerLegacy(etesync);
              await syncManager.clearDeviceCollections(managers);
            }

            SyncManager.removeManager(etesync);

            unregisterSyncTask(etesync.credentials.email);
          }
          if (etebase) {
            const managers = [];
            if (clearAddressBooks) {
              managers.push(SyncManagerAddressBook);
            }
            if (clearCalendars) {
              managers.push(SyncManagerCalendar);
              managers.push(SyncManagerTaskList);
            }

            if (managers.length > 0) {
              const syncManager = SyncManager.getManager(etebase);
              await syncManager.clearDeviceCollections(managers);
            }

            SyncManager.removeManager(etebase);

            unregisterSyncTask(etebase.user.username);

            await etebase.logout();
          }
        } catch (e) {
          error = e;
        }

        // Here we log out regardless if we actually have an etesync
        dispatch(logout(etebase ?? etesync));

        persistor.persist();

        // We want to still logout on error, just not dismiss the error message.
        if (error) {
          throw error;
        }
        props.onDismiss(true);
      }}
      onCancel={() => props.onDismiss(false)}
    >
      <Paragraph>
        Are you sure you would like to log out?
        Logging out will remove your account and all of its data from your device, and unsynced changes WILL be lost.
      </Paragraph>
      {C.syncAppMode && (
        <>
          <Paragraph>
            Additionally, should EteSync calendars and address books be removed from your device when logging out?
          </Paragraph>
          <List.Item
            title="Remove contacts"
            description={(clearAddressBooks) ? "Removing contacts from device" : "Keeping contacts on device"}
            right={(props) =>
              <Switch
                {...props}
                color={theme.colors.accent}
                value={clearAddressBooks}
                onValueChange={setClearAddressBooks}
              />
            }
          />
          <List.Item
            title="Remove calendars"
            description={(clearCalendars) ? "Removing events and reminders from device" : "Keeping events and reminers on device"}
            right={(props) =>
              <Switch
                {...props}
                color={theme.colors.accent}
                value={clearCalendars}
                onValueChange={setClearCalendars}
              />
            }
          />
        </>
      )}
    </ConfirmationDialog>
  );
}
