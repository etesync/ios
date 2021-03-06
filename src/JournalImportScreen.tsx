// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { useSelector } from "react-redux";
import * as Calendar from "expo-calendar";
import { Divider, List, Paragraph } from "react-native-paper";
import { useNavigation, RouteProp } from "@react-navigation/native";

import { SyncManager } from "./sync/SyncManager";
import { useCredentials } from "./login";
import { useSyncGate } from "./SyncGate";
import { store, StoreState } from "./store";
import { performSync } from "./store/actions";

import ScrollView from "./widgets/ScrollView";
import Container from "./widgets/Container";
import ColorBox from "./widgets/ColorBox";
import LoadingIndicator from "./widgets/LoadingIndicator";
import ConfirmationDialog from "./widgets/ConfirmationDialog";
import ErrorDialog from "./widgets/ErrorDialog";

interface ImportCollection {
  id: string;
  color?: string;
  title: string;
  description: string;
}

function cleanCalendrItemForWriting(event: Calendar.Event | Calendar.Reminder) {
  const readOnlyKeys = ["id", "calendarId", "creationDate", "lastModifiedDate", "originalStartDate", "isDetached"];
  for (const key in event) {
    if (Object.prototype.hasOwnProperty.call(event, key)) {
      if ((event[key] === null) || (key in readOnlyKeys)) {
        delete event[key];
      }
    }
  }
}

async function eventsImport(localId: string, toLocalId: string) {
  const now = new Date();
  const dateYearRange = 4; // Maximum year range supported on iOS
  const handled = {};

  for (let i = -2 ; i <= 1 ; i++) {
    const eventsRangeStart = new Date(new Date().setFullYear(now.getFullYear() + (i * dateYearRange)));
    const eventsRangeEnd = new Date(new Date().setFullYear(now.getFullYear() + ((i + 1) * dateYearRange)));

    const existingEvents = await Calendar.getEventsAsync([localId], eventsRangeStart, eventsRangeEnd);
    for (const event of existingEvents) {
      if (handled[event.id]) {
        continue;
      }

      handled[event.id] = true;
      // FIXME: remove read-only fields
      cleanCalendrItemForWriting(event);
      await Calendar.createEventAsync(toLocalId, event);
    }
  }
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

async function tasksImport(localId: string, toLocalId: string) {
  const handled = {};

  const existingTasks = await Calendar.getRemindersAsync([localId] as any, null, null as unknown as Date, null as unknown as Date);
  for (const task of existingTasks) {
    if (handled[task.id!]) {
      continue;
    }
    handled[task.id!] = true;

    // FIXME: remove read-only fields
    cleanCalendrItemForWriting(task);
    await Calendar.createReminderAsync(toLocalId, task);
  }
}

type RootStackParamList = {
  JournalImportScreen: {
    journalUid: string;
  };
};

interface PropsType {
  route: RouteProp<RootStackParamList, "JournalImportScreen">;
}

const JournalImportScreen = function _JournalImportScreen(props: PropsType) {
  const [deviceCollections, setDeviceCollections] = React.useState<ImportCollection[] | undefined>(undefined);
  const [selectedCollection, setSelectedCollection] = React.useState<ImportCollection | null>(null);
  const permissions = useSelector((state: StoreState) => state.permissions);
  const syncStateJournals = useSelector((state: StoreState) => state.sync.stateJournals);
  const syncInfoCollections = useSelector((state: StoreState) => state.cache.syncInfoCollection);
  const syncGate = useSyncGate();
  const etesync = useCredentials()!;
  const navigation = useNavigation();

  if (syncGate) {
    return syncGate;
  }

  const { journalUid } = props.route.params;
  const collectionType = syncInfoCollections.get(journalUid)!.type;

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
  let importCollection: typeof eventsImport;
  let showDisclaimer: boolean;
  switch (collectionType) {
    case "CALENDAR": {
      fetchDeviceCollections = eventsFetchDeviceCollections;
      importCollection = eventsImport;
      showDisclaimer = true;
      break;
    }
    case "TASKS": {
      fetchDeviceCollections = tasksFetchDeviceCollections;
      importCollection = tasksImport;
      showDisclaimer = true;
      break;
    }
    default: {
      return (
        <ErrorDialog
          title="Not Supported"
          error="Importing this collection type is not currently supported."
          onOk={() => {
            navigation.goBack();
          }}
        />
      );
    }
  }

  if (!deviceCollections) {
    fetchDeviceCollections(setDeviceCollections);
    return (<LoadingIndicator />);
  }

  const syncStateJournal = syncStateJournals.get(journalUid);

  if (!syncStateJournal) {
    return (
      <ErrorDialog
        error="Could not find local collection to import to. Please contact developers."
        onOk={() => {
          navigation.goBack();
        }}
      />
    );
  }

  return (
    <React.Fragment>
      {(showDisclaimer) ? (
        <>
          <Container>
            <Paragraph>
              Due to limitations in iOS only items from up to 8 years in the past and 4 years in the future will be imported.
            </Paragraph>
          </Container>
          <Divider />
        </>
      ) : null
      }
      <ScrollView style={{ flex: 1 }}>
        {deviceCollections.map(
          (collection) => (collection.id === syncStateJournal.localId) ?
            null : (
              <List.Item
                key={collection.id}
                title={collection.title}
                right={() => ((collection.color) ?
                  <ColorBox size={36} color={collection.color} /> :
                  null
                )}
                description={collection.description}
                onPress={() => setSelectedCollection(collection)}
              />
            )
        )}
      </ScrollView>
      <ConfirmationDialog
        title="Import Confirmation"
        visible={!!selectedCollection}
        loadingText="Please wait, may take a while..."
        onOk={async () => {
          await importCollection(selectedCollection!.id, syncStateJournal.localId);
          const syncManager = SyncManager.getManagerLegacy(etesync);
          store.dispatch(performSync(syncManager.sync())); // not awaiting on puprose
          setSelectedCollection(null);
          navigation.goBack();
        }}
        onCancel={() => {
          setSelectedCollection(null);
        }}
      >
        <Paragraph>
          Are you sure you would like to import from "{selectedCollection && selectedCollection.title}?"
        </Paragraph>
      </ConfirmationDialog>
    </React.Fragment>
  );
};

export default JournalImportScreen;
