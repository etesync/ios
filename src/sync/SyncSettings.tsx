import * as React from 'react';

import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import { getContainers } from '../EteSyncNative';

import { useDispatch, useSelector } from 'react-redux';
import { List, Paragraph, Switch, useTheme } from 'react-native-paper';

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
          Unlike the calendar sync, the contact sync has no separation between existing contacts and EteSync contacts.
        </Paragraph>
        <Paragraph>
          This means that once your turn this on, all of your local contacts will be automatically merged with your EteSync contacts.
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

