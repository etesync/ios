import * as React from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { List, Paragraph, Switch, useTheme } from 'react-native-paper';

import { getLocalContainer } from './helpers';
import { StoreState } from '../store';
import { setSettings } from '../store/actions';
import ConfirmationDialog from '../widgets/ConfirmationDialog';

interface DialogPropsType {
  visible: boolean;
  onDismiss: () => void;
}

function SyncContactsConfirmationDialog(props: DialogPropsType) {
  const dispatch = useDispatch();
  if (!props.visible) {
    return <React.Fragment />;
  }

  const container = getLocalContainer();

  if (!container) {
    return (
      <ConfirmationDialog
        title="Failed Enabling Sync"
        visible={props.visible}
        onCancel={props.onDismiss}
      >
        <>
          <Paragraph>
            Because of limitations in iOS, EteSync is only able to sync with your local (on device) address book, which is unfortunaetly turned off while iCloud contacts sync is enabled.
          </Paragraph>
          <Paragraph>
            To enable contact sync you would therefore need to turn off iCloud contacts sync. You can do this by going to "Settings -> Passwords & Accounts -> iCloud" and uncheck "Contacts".
          </Paragraph>
        </>
      </ConfirmationDialog>
    );
  }

  return (
    <ConfirmationDialog
      title="Important!"
      visible={props.visible}
      onOk={() => {
        dispatch(setSettings({ syncContacts: true }));
        props.onDismiss();
      }}
      onCancel={props.onDismiss}
    >
      <>
        <Paragraph>
          Contact sync is not on by default because unlike the calendar sync, it syncs to your local address book instead of a special account.
        </Paragraph>
        <Paragraph>
          This means that there is no separation, and once your turn this on, all of your local contacts will be automatically merged with your EteSync contacts.
        </Paragraph>
      </>
    </ConfirmationDialog>
  );
}

export default function SyncSettings() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const settings = useSelector((state: StoreState) => state.settings);
  const [showSyncContactsWarning, setShowSyncContactsWarning] = React.useState(false);

  return (
    <>
      <List.Item
        title="Sync Contacts"
        description="Sync contacts with the default address book"
        right={(props) =>
          <Switch
            {...props}
            color={theme.colors.accent}
            value={settings.syncContacts}
            onValueChange={(value) => {
              if (value) {
                setShowSyncContactsWarning(true);
              } else {
                dispatch(setSettings({ syncContacts: false }));
              }
            }}
          />
        }
      />
      <List.Item
        title="Sync Calendars"
        description="Sync events and reminders with the default calendar"
        right={(props) =>
          <Switch
            {...props}
            color={theme.colors.accent}
            value={settings.syncContacts}
            onValueChange={(_value) => {
              dispatch(setSettings({}));
            }}
          />
        }
      />
      <SyncContactsConfirmationDialog visible={showSyncContactsWarning} onDismiss={() => setShowSyncContactsWarning(false)} />
    </>
  );
}

