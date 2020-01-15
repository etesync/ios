import * as React from 'react';
import { useNavigation } from './navigation/Hooks';
import { List, Paragraph, Switch, useTheme } from 'react-native-paper';

import { useDispatch } from 'react-redux';
import { persistor } from './store';
import { logout } from './store/actions';

import { SyncManagerAddressBook } from './sync/SyncManagerAddressBook';
import { SyncManagerCalendar } from './sync/SyncManagerCalendar';
import { SyncManagerTaskList } from './sync/SyncManagerTaskList';
import { unregisterSyncTask, SyncManager } from './sync/SyncManager';

import ConfirmationDialog from './widgets/ConfirmationDialog';

import { useCredentials } from './login';

import * as C from './constants';

export default function LogoutDialog(props: { visible: boolean, onDismiss: (loggedOut: boolean) => void }) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const theme = useTheme();
  const etesync = useCredentials();
  const [clearAddressBooks, setClearAddressBooks] = React.useState(true);
  const [clearCalendars, setClearCalendars] = React.useState(true);

  if (!etesync) {
    return null;
  }

  return (
    <ConfirmationDialog
      title="Are you sure?"
      visible={props.visible}
      onOk={async () => {
        const managers = [];
        if (clearAddressBooks) {
          managers.push(SyncManagerAddressBook);
        }
        if (clearCalendars) {
          managers.push(SyncManagerCalendar);
          managers.push(SyncManagerTaskList);
        }

        if (managers.length > 0) {
          const syncManager = SyncManager.getManager(etesync);
          await syncManager.clearDeviceCollections(managers);
        }

        dispatch(logout());
        navigation.closeDrawer();
        navigation.navigate('Auth');
        unregisterSyncTask(etesync.credentials.email);

        persistor.persist();

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
            description={(clearAddressBooks) ? 'Removing contacts from device' : 'Keeping contacts on device'}
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
            description={(clearCalendars) ? 'Removing events and reminders from device' : 'Keeping events and reminers on device'}
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
