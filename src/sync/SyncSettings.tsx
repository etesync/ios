import * as React from 'react';

import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import { getContainers } from '../EteSyncNative';

import { useDispatch, useSelector } from 'react-redux';
import { List, Paragraph, Switch, useTheme } from 'react-native-paper';

import { getLocalContainer } from './helpers';
import { StoreState } from '../store';
import { setSettings } from '../store/actions';
import ConfirmationDialog from '../widgets/ConfirmationDialog';

const ACCOUNT_NAME = 'etesync';

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
  const [defaultContainer, setDefaultContainer] = React.useState<Contacts.Container>();
  const [defaultSource, setDefaultSource] = React.useState<Calendar.Source>();

  React.useEffect(() => {
    getContainers().then((containers) => {
      for (const container of containers) {
        if ((container.type === Contacts.ContainerTypes.Local) || (container.name === 'iCloud')) {
          setDefaultContainer(container);
          break;
        }
      }
    });
    Calendar.getSourcesAsync().then((sources) => {
      for (const source of sources) {
        if ((source.type === Calendar.SourceType.LOCAL) || (source.name === 'iCloud')) {
          setDefaultSource(source);
        } else if (source.name.toLowerCase() === ACCOUNT_NAME) {
          setDefaultSource(source);
          break;
        }
      }
    });
  }, []);

  return (
    <>
      <List.Item
        title="Sync Contacts"
        description={`Sync contacts with account: "${(defaultContainer?.type === Contacts.ContainerTypes.Local) ? 'local' : defaultContainer?.name}"`}
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
        description={`Sync events and reminders with account: "${(defaultSource?.type === Calendar.SourceType.LOCAL) ? 'local' : defaultSource?.name}"`}
        right={(props) =>
          <Switch
            {...props}
            color={theme.colors.accent}
            value={settings.syncCalendars}
            onValueChange={(value) => {
              dispatch(setSettings({ syncCalendars: value }));
            }}
          />
        }
      />
      <SyncContactsConfirmationDialog visible={showSyncContactsWarning} onDismiss={() => setShowSyncContactsWarning(false)} />
    </>
  );
}

