import * as React from 'react';
import { useSelector } from 'react-redux';
import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import { NavigationScreenComponent } from 'react-navigation';
import { useNavigation } from './navigation/Hooks';
import { Divider, List, Paragraph } from 'react-native-paper';

import { useSyncGate } from './SyncGate';
import { StoreState } from './store';

import { ContactType, EventType, TaskType } from './pim-types';

import ScrollView from './widgets/ScrollView';
import Container from './widgets/Container';
import ColorBox from './widgets/ColorBox';
import LoadingIndicator from './widgets/LoadingIndicator';
import ConfirmationDialog from './widgets/ConfirmationDialog';
import { eventVobjectToNative, taskVobjectToNative, contactVobjectToNative } from './sync/helpers';

interface ImportCollection {
  id: string;
  color?: string;
  title: string;
  description: string;
}

async function contactsFetchDeviceCollections(setDeviceCollections: (collections: ImportCollection[]) => void) {
  const containers = await Contacts.getContainersAsync({ containerId: await Contacts.getDefaultContainerIdAsync() });
  setDeviceCollections(containers.map((container) => {
    return {
      id: container.id,
      title: container.name,
      description: container.type,
    };
  }).sort((a, b) => a.title.localeCompare(b.title)));
}

function calendarFetchDeviceCollections(setDeviceCollections: (collections: ImportCollection[]) => void, entityType: string) {
  Calendar.getCalendarsAsync(entityType).then((calendars) => {
    setDeviceCollections(calendars.map((calendar) => {
      return {
        id: calendar.id,
        color: calendar.color,
        title: calendar.title,
        description: `${calendar.source.name} (${calendar.source.type})`,
      };
    }).sort((a, b) => a.title.localeCompare(b.title)));
  });
}

function eventsFetchDeviceCollections(setDeviceCollections: (collections: ImportCollection[]) => void) {
  calendarFetchDeviceCollections(setDeviceCollections, Calendar.EntityTypes.EVENT);
}

function tasksFetchDeviceCollections(setDeviceCollections: (collections: ImportCollection[]) => void) {
  calendarFetchDeviceCollections(setDeviceCollections, Calendar.EntityTypes.REMINDER);
}

async function saveContact(localId: string, content: string) {
  const vcard = ContactType.parse(content);
  const contact = contactVobjectToNative(vcard);
  await Contacts.addContactAsync(contact, localId);
}

async function saveEvent(localId: string, content: string) {
  const ical = EventType.parse(content);
  const event = eventVobjectToNative(ical);
  await Calendar.createEventAsync(localId, event);
}

async function saveTask(localId: string, content: string) {
  const ical = TaskType.parse(content);
  const task = taskVobjectToNative(ical);
  await Calendar.createReminderAsync(localId, task);
}

const JournalItemSaveScreen: NavigationScreenComponent = function _JournalItemSaveScreen() {
  const [deviceCollections, setDeviceCollections] = React.useState<ImportCollection[] | undefined>(undefined);
  const permissions = useSelector((state: StoreState) => state.permissions);
  const syncStateJournals = useSelector((state: StoreState) => state.sync.stateJournals);
  const syncInfoCollections = useSelector((state: StoreState) => state.cache.syncInfoCollection);
  const syncInfoEntries = useSelector((state: StoreState) => state.cache.syncInfoItem);
  const syncGate = useSyncGate();
  const navigation = useNavigation();

  if (syncGate) {
    return syncGate;
  }

  const journalUid = navigation.getParam('journalUid');
  const collectionType = syncInfoCollections.get(journalUid)!.type;
  const entryUid = navigation.getParam('entryUid');
  const entry = syncInfoEntries.get(journalUid)!.get(entryUid)!;

  if (!permissions.get(collectionType)) {
    return (
      <ConfirmationDialog
        title="Permision Denied"
        visible
        onOk={() => {
          navigation.goBack();
        }}
      >
        <Paragraph>Please give the app the appropriate permissions from the system's Settings app.</Paragraph>
      </ConfirmationDialog>
    );
  }

  let fetchDeviceCollections: typeof eventsFetchDeviceCollections;
  let saveItem: typeof saveEvent;
  switch (collectionType) {
    case 'ADDRESS_BOOK': {
      fetchDeviceCollections = contactsFetchDeviceCollections;
      saveItem = saveContact;
      break;
    }
    case 'CALENDAR': {
      fetchDeviceCollections = eventsFetchDeviceCollections;
      saveItem = saveEvent;
      break;
    }
    case 'TASKS': {
      fetchDeviceCollections = tasksFetchDeviceCollections;
      saveItem = saveTask;
      break;
    }
    default: {
      return (
        <ConfirmationDialog
          title="Not Supported"
          visible
          onOk={() => {
            navigation.goBack();
          }}
        >
          <Paragraph>Saving this item type is not currently supported.</Paragraph>
        </ConfirmationDialog>
      );
    }
  }

  if (!deviceCollections) {
    fetchDeviceCollections(setDeviceCollections);
    return (<LoadingIndicator />);
  }

  const syncStateJournal = syncStateJournals.get(journalUid);

  return (
    <React.Fragment>
      <Container>
        <Paragraph>
          Choose a collection to save the item to:
        </Paragraph>
      </Container>
      <Divider />
      <ScrollView style={{ flex: 1 }}>
        {deviceCollections.map(
          (collection) => (collection.id === syncStateJournal?.localId) ?
            null : (
              <List.Item
                key={collection.id}
                title={collection.title}
                right={() => ((collection.color) ?
                  <ColorBox size={36} color={collection.color} /> :
                  null
                )}
                description={collection.description}
                onPress={() => {
                  saveItem(collection.id, entry.content).then(() => {
                    navigation.goBack();
                  });
                }}
              />
            )
        )}
      </ScrollView>
    </React.Fragment>
  );
};

JournalItemSaveScreen.navigationOptions = {
  title: 'Save Item',
};

export default JournalItemSaveScreen;
