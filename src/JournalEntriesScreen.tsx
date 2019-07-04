import * as React from 'react';
import { NavigationScreenComponent } from 'react-navigation';
import { useSelector } from 'react-redux';
import { useNavigation } from './navigation/Hooks';
import { Text, ScrollView } from 'react-native';
import { List } from 'react-native-paper';

import { useSyncInfo } from './SyncHandler';

import * as ICAL from 'ical.js';

import { StoreState } from './store';
import LoadingIndicator from './widgets/LoadingIndicator';

import { TaskType, EventType, ContactType } from './pim-types';

import * as EteSync from './api/EteSync';

const mapStateToStoreProps = (state: StoreState) => {
  return {
    syncStateEntries: state.sync.stateEntries,
  };
};

const listIcons = {
  [EteSync.SyncEntryAction.Add]: (props: any) => (<List.Icon {...props} color="#16B14B" icon="add" />),
  [EteSync.SyncEntryAction.Change]: (props: any) => (<List.Icon {...props} color="#FEB115" icon="edit" />),
  [EteSync.SyncEntryAction.Delete]: (props: any) => (<List.Icon {...props} color="#F20C0C" icon="delete" />),
};

const JournalEntries: NavigationScreenComponent = function _JournalEntries() {
  const syncInfo = useSyncInfo();
  const navigation = useNavigation();
  const { syncStateEntries } = useSelector(mapStateToStoreProps);

  if (!syncInfo) {
    return (<LoadingIndicator />);
  }

  const journalUid = navigation.getParam('journalUid');
  const syncInfoJournal = syncInfo.get(journalUid);
  const { entries } = syncInfoJournal;
  const itemCount = syncStateEntries.has(journalUid) ?
      syncStateEntries.get(journalUid).count() :
      -1;

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
    <>
      <Text>Items: {itemCount}, Entry items: {entries.count()}</Text>
      <ScrollView style={{ flex: 1 }}>
        <List.Section>
          {changeEntries}
        </List.Section>
      </ScrollView>
    </>
  );
};

JournalEntries.navigationOptions = {
  title: 'Change Journal',
};

export default JournalEntries;
