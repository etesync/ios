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

interface SelectSourcePropsType<T> {
  title: string;
  currentSource: T | undefined;
  options: T[];
  onChange: (item: T | null) => void;
}

function SelectSource<T extends Calendar.Source | Contacts.Container>(props: SelectSourcePropsType<T>) {
  const { title, currentSource, options, onChange } = props;
  const theme = useTheme();
  const [selectSourceOpen, setSelectSourceOpen] = React.useState(false);
  const currentSourceName = (options) ? titleAccessor(currentSource ?? null) : 'Loading';

  return (
    <List.Item
      title={title}
      right={(props) =>
        <Select
          {...props}
          visible={selectSourceOpen}
          noneString="No sync"
          onDismiss={() => setSelectSourceOpen(false)}
          options={options ?? []}
          titleAccossor={titleAccessor}
          onChange={(source) => {
            setSelectSourceOpen(false);
            onChange(source);
          }}
          anchor={(
            <Button mode="contained" color={theme.colors.accent} onPress={() => setSelectSourceOpen(true)}>{currentSourceName}</Button>
          )}
        />
      }
    />
  );
}

export default function SyncSettings() {
  const dispatch = useDispatch();
  const settings = useSelector((state: StoreState) => state.settings);
  const [selectedContainer, setSelectedContainer] = React.useState<Contacts.Container>();
  const [availableContainers, setAvailableContainers] = React.useState<Contacts.Container[]>();
  const [availableSources, setAvailableSources] = React.useState<Calendar.Source[]>();

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

  return (
    <>
      <SelectSource<Contacts.Container>
        title="Sync Contacts"
        options={availableContainers ?? []}
        currentSource={currentContainer}
        onChange={(container) => {
          setSelectedContainer(container ?? undefined);
          if (!container) {
            dispatch(setSettings({ syncContactsContainer: null }));
          }
        }}
      />
      <SelectSource<Calendar.Source>
        title="Sync Calendars"
        options={availableSources ?? []}
        currentSource={currentSource}
        onChange={(source) => {
          dispatch(setSettings({ syncCalendarsSource: source?.id ?? null }));
        }}
      />
      <SyncContactsConfirmationDialog visible={!!selectedContainer} container={selectedContainer!} onDismiss={() => setSelectedContainer(undefined)} />
    </>
  );
}

