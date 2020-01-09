import * as React from 'react';

import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import { getContainers } from '../EteSyncNative';

import { useDispatch, useSelector } from 'react-redux';
import { List, Button, Paragraph, useTheme } from 'react-native-paper';

import { StoreState } from '../store';
import { setSettings } from '../store/actions';
import ConfirmationDialog from '../widgets/ConfirmationDialog';
import Select from '../widgets/Select';

interface DialogPropsType {
  visible: boolean;
  onDismiss: () => void;
  container: Contacts.Container;
}

function SyncContactsConfirmationDialog(props: DialogPropsType) {
  const dispatch = useDispatch();

  return (
    <ConfirmationDialog
      title="Important!"
      visible={props.visible}
      onOk={() => {
        dispatch(setSettings({ syncContactsContainer: props.container.id }));
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

function titleAccessor(item: Contacts.Container | Calendar.Source | null) {
  if (!item) {
    return 'No sync';
  }
  return `${item.name || item.type} (${item.type})`;
}

export default function SyncSettings() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const settings = useSelector((state: StoreState) => state.settings);
  const [selectedContainer, setSelectedContainer] = React.useState<Contacts.Container>();
  const [availableContainers, setAvailableContainers] = React.useState<Contacts.Container[]>();
  const [availableSources, setAvailableSources] = React.useState<Calendar.Source[]>();
  const [selectContainerOpen, setSelectContainerOpen] = React.useState(false);
  const [selectSourceOpen, setSelectSourceOpen] = React.useState(false);

  React.useEffect(() => {
    getContainers().then((containers) => {
      setAvailableContainers(containers.filter((container) => container.type !== Contacts.ContainerTypes.Unassigned));
    });
    Calendar.getSourcesAsync().then((sources) => {
      const allowedTypes = [Calendar.SourceType.LOCAL, Calendar.SourceType.CALDAV, Calendar.SourceType.EXCHANGE];
      setAvailableSources(sources.filter((source) => allowedTypes.includes(source.type)));
    });
  }, []);

  const currentContainer = availableContainers?.find((container) => container.id === settings.syncContactsContainer);
  const currentSource = availableSources?.find((source) => source.id === settings.syncCalendarsSource);
  const currentContainerName = (availableContainers) ? titleAccessor(currentContainer ?? null) : 'Loading';
  const currentSourceName = (availableSources) ? titleAccessor(currentSource ?? null) : 'Loading';

  return (
    <>
      <List.Item
        title="Sync Contacts"
        right={(props) =>
          <Select
            {...props}
            visible={selectContainerOpen}
            noneString="No sync"
            onDismiss={() => setSelectContainerOpen(false)}
            options={availableContainers ?? []}
            titleAccossor={titleAccessor}
            onChange={(container) => {
              setSelectContainerOpen(false);
              setSelectedContainer(container ?? undefined);
              if (!container) {
                dispatch(setSettings({ syncContactsContainer: null }));
              }
            }}
            anchor={(
              <Button mode="contained" color={theme.colors.accent} onPress={() => setSelectContainerOpen(true)}>{currentContainerName}</Button>
            )}
          />
        }
      />
      <List.Item
        title="Sync Calendars"
        right={(props) =>
          <Select
            {...props}
            visible={selectSourceOpen}
            noneString="No sync"
            onDismiss={() => setSelectSourceOpen(false)}
            options={availableSources ?? []}
            titleAccossor={titleAccessor}
            onChange={(source) => {
              setSelectSourceOpen(false);
              dispatch(setSettings({ syncCalendarsSource: source?.id ?? null }));
            }}
            anchor={(
              <Button mode="contained" color={theme.colors.accent} onPress={() => setSelectSourceOpen(true)}>{currentSourceName}</Button>
            )}
          />
        }
      />
      <SyncContactsConfirmationDialog visible={!!selectedContainer} container={selectedContainer!} onDismiss={() => setSelectedContainer(undefined)} />
    </>
  );
}

