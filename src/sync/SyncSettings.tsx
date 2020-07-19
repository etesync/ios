// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from 'react';

import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import { getContainers } from '../EteSyncNative';

import { useDispatch, useSelector } from 'react-redux';
import { List, Button, Paragraph, useTheme } from 'react-native-paper';

import { logger } from '../logging';

import { StoreState, CredentialsData } from '../store';
import { setSettings } from '../store/actions';
import ConfirmationDialog from '../widgets/ConfirmationDialog';
import Select from '../widgets/Select';
import { useRemoteCredentials } from '../login';
import { SyncManager } from './SyncManager';
import { SyncManagerAddressBook } from './SyncManagerAddressBook';
import { SyncManagerCalendar } from './SyncManagerCalendar';
import { SyncManagerTaskList } from './SyncManagerTaskList';

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
  currentSource: T | null;
  options: T[];
  onChange: (item: T | null) => void;
}

function SelectSource<T extends Calendar.Source | Contacts.Container>(props: SelectSourcePropsType<T>) {
  const { title, currentSource, options, onChange } = props;
  const theme = useTheme();
  const [selectSourceOpen, setSelectSourceOpen] = React.useState(false);
  const currentSourceName = (options) ? titleAccessor(currentSource ?? null) : 'Loading';

  return (
    <>
      <List.Item
        title={title}
        accessible={false}
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
              if (source === currentSource) {
                return;
              }
              onChange(source);
            }}
            anchor={(
              <Button mode="contained" color={theme.colors.accent} onPress={() => setSelectSourceOpen(true)}>{currentSourceName}</Button>
            )}
          />
        }
      />
    </>
  );
}

function logResourceList(resources: (Calendar.Source | Contacts.Container)[]) {
  logger.debug(resources.map((x) => `${x.type}: ${x.name} (${x.id})`).join(', '));
}

export default function SyncSettings() {
  const dispatch = useDispatch();
  const settings = useSelector((state: StoreState) => state.settings);
  const etesync = useRemoteCredentials() as CredentialsData;
  const [selectedContainer, setSelectedContainer] = React.useState<Contacts.Container>();
  const [availableContainers, setAvailableContainers] = React.useState<Contacts.Container[]>();
  const [availableSources, setAvailableSources] = React.useState<Calendar.Source[]>();
  const [confirmContactsRemovalOpen, setConfirmContactsRemovalOpen] = React.useState(false);
  const [confirmCalendarsRemovalOpen, setConfirmCalendarsRemovalOpen] = React.useState(false);

  React.useEffect(() => {
    getContainers().then((containers) => {
      const allowedContainers = containers.filter((container) => container.type !== Contacts.ContainerTypes.Unassigned);
      logResourceList(allowedContainers);
      setAvailableContainers(allowedContainers);
    });
    Calendar.getSourcesAsync().then((sources) => {
      const allowedTypes = [Calendar.SourceType.LOCAL, Calendar.SourceType.CALDAV, Calendar.SourceType.EXCHANGE];
      const allowedSources = sources.filter((source) => allowedTypes.includes(source.type));
      logResourceList(allowedSources);
      setAvailableSources(allowedSources);
    });
  }, []);

  const currentContainer = availableContainers?.find((container) => container.id === settings.syncContactsContainer) ?? null;
  const currentSource = availableSources?.find((source) => source.id === settings.syncCalendarsSource) ?? null;

  return (
    <>
      <SelectSource<Contacts.Container>
        title="Sync Contacts"
        options={availableContainers ?? []}
        currentSource={currentContainer}
        onChange={(container) => {
          if (container) {
            setSelectedContainer(container);
          } else {
            setConfirmContactsRemovalOpen(true);
          }
        }}
      />
      <SelectSource<Calendar.Source>
        title="Sync Calendars & Reminders"
        options={availableSources ?? []}
        currentSource={currentSource}
        onChange={(source) => {
          if (source) {
            dispatch(setSettings({ syncCalendarsSource: source.id }));
          } else {
            setConfirmCalendarsRemovalOpen(true);
          }
        }}
      />
      <SyncContactsConfirmationDialog visible={!!selectedContainer} container={selectedContainer!} onDismiss={() => setSelectedContainer(undefined)} />
      <ConfirmationDialog
        title="Remove contacts"
        visible={confirmContactsRemovalOpen}
        onOk={async () => {
          if (etesync) {
            const syncManager = SyncManager.getManager(etesync);
            await syncManager.clearDeviceCollections([SyncManagerAddressBook]);
          }
          dispatch(setSettings({ syncContactsContainer: null }));
          setConfirmContactsRemovalOpen(false);
        }}
        onCancel={() => setConfirmContactsRemovalOpen(false)}
      >
        <>
          <Paragraph>
            Disabling contacts sync will remove your EteSync contacts from your device. Would you like to procceed?
          </Paragraph>
          <Paragraph>
            If for example you are syncing with iCloud, your iCloud items will be removed too. Would you like to procceed?
          </Paragraph>
        </>
      </ConfirmationDialog>
      <ConfirmationDialog
        title="Remove calendars"
        visible={confirmCalendarsRemovalOpen}
        onOk={async () => {
          if (etesync) {
            const syncManager = SyncManager.getManager(etesync);
            await syncManager.clearDeviceCollections([SyncManagerCalendar, SyncManagerTaskList]);
          }
          dispatch(setSettings({ syncCalendarsSource: null }));
          setConfirmCalendarsRemovalOpen(false);
        }}
        onCancel={() => setConfirmCalendarsRemovalOpen(false)}
      >
        <>
          <Paragraph>
            Disabling calendars sync will remove your EteSync events and reminders from your device.
          </Paragraph>
          <Paragraph>
            Would you like to procceed?
          </Paragraph>
        </>
      </ConfirmationDialog>
    </>
  );
}

