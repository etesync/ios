import * as React from 'react';
import { useNavigation } from './navigation/Hooks';
import { ScrollView } from 'react-native';
import { List } from 'react-native-paper';

import { useSyncInfo } from './SyncHandler';

import * as ICAL from 'ical.js';

import LoadingIndicator from './widgets/LoadingIndicator';

import { TaskType, EventType, ContactType } from './pim-types';

import * as EteSync from './api/EteSync';

const listIcons = {
  [EteSync.SyncEntryAction.Add]: (props: any) => (<List.Icon {...props} color="#16B14B" icon="add" />),
  [EteSync.SyncEntryAction.Change]: (props: any) => (<List.Icon {...props} color="#FEB115" icon="edit" />),
  [EteSync.SyncEntryAction.Delete]: (props: any) => (<List.Icon {...props} color="#F20C0C" icon="delete" />),
};

function JournalEntries() {
  const syncInfo = useSyncInfo();
  const navigation = useNavigation();

  if (!syncInfo) {
    return (<LoadingIndicator />);
  }

  const syncInfoJournal = syncInfo.get(navigation.getParam('journalUid'));
  const { entries } = syncInfoJournal;

  const changeEntries = entries.map((syncEntry, idx) => {
    const comp = new ICAL.Component(ICAL.parse(syncEntry.content));

    const icon = listIcons[syncEntry.action];

    let name;
    let uid;
    if (comp.name === 'vcalendar') {
      if (EventType.isEvent(comp)) {
        const vevent = EventType.fromVCalendar(comp);
        name = vevent.summary;
        uid = vevent.uid;
      } else {
        const vtodo = TaskType.fromVCalendar(comp);
        name = vtodo.summary;
        uid = vtodo.uid;
      }
    } else if (comp.name === 'vcard') {
      const vcard = new ContactType(comp);
      name = vcard.fn;
      uid = vcard.uid;
    } else {
      name = 'Error processing entry';
      uid = '';
    }

    return (
      <List.Item
        key={idx}
        left={icon}
        title={name}
        description={uid}
      />
    );
  }).reverse();

  return (
    <ScrollView style={{ flex: 1 }}>
      <List.Section>
        {changeEntries}
      </List.Section>
    </ScrollView>
  );
}

export default JournalEntries;
