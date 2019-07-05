import * as React from 'react';
import { NavigationScreenComponent } from 'react-navigation';
import { useSelector } from 'react-redux';
import { useNavigation } from './navigation/Hooks';
import { View, ScrollView } from 'react-native';
import { Menu, Divider, Appbar, Title, Text, List } from 'react-native-paper';

import { useSyncInfo } from './SyncHandler';

import * as ICAL from 'ical.js';

import { StoreState } from './store';
import LoadingIndicator from './widgets/LoadingIndicator';
import Container from './widgets/Container';

import { TaskType, EventType, ContactType } from './pim-types';

import * as EteSync from './api/EteSync';
import { colorIntToHtml } from './helpers';

import ColorBox from './widgets/ColorBox';

const listIcons = {
  [EteSync.SyncEntryAction.Add]: (props: any) => (<List.Icon {...props} color="#16B14B" icon="add" />),
  [EteSync.SyncEntryAction.Change]: (props: any) => (<List.Icon {...props} color="#FEB115" icon="edit" />),
  [EteSync.SyncEntryAction.Delete]: (props: any) => (<List.Icon {...props} color="#F20C0C" icon="delete" />),
};

const JournalEntries: NavigationScreenComponent = function _JournalEntries() {
  const syncInfo = useSyncInfo();
  const navigation = useNavigation();
  const { syncStateEntries } = useSelector(
    (state: StoreState) => ({
      syncStateEntries: state.sync.stateEntries,
    })
  );

  if (!syncInfo) {
    return (<LoadingIndicator />);
  }

  const journalUid = navigation.getParam('journalUid');
  const syncInfoJournal = syncInfo.get(journalUid);
  const { collection, entries } = syncInfoJournal;
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
        onPress={() => navigation.navigate('JournalItem', { journalUid, entryUid: syncEntry.uid })}
      />
    );
  }).reverse();

  let collectionColorBox: React.ReactNode;
  switch (collection.type) {
    case 'CALENDAR':
    case 'TASKS':
      collectionColorBox = (
        <ColorBox  size={36} color={colorIntToHtml(collection.color)} />
      );
      break;
  }

  return (
    <>
      <Container style={{ flexDirection: 'row' }}>
        <View style={{ marginRight: 'auto' }}>
          <Title>{collection.displayName} ({journalUid.slice(0, 5)})</Title>
          <Text>Items: {itemCount}, Entry items: {entries.count()}</Text>
        </View>
        {collectionColorBox}
      </Container>
      <Divider />
      <ScrollView style={{ flex: 1 }}>
        <List.Section>
          {changeEntries}
        </List.Section>
      </ScrollView>
    </>
  );
};

function RightAction() {
  const [showMenu, setShowMenu] = React.useState(false);
  const navigation = useNavigation();

  const journalUid = navigation.getParam('journalUid');

  return (
    <Menu
      visible={showMenu}
      onDismiss={() => setShowMenu(false)}
      anchor={(
        <Appbar.Action icon="more-vert" onPress={() => setShowMenu(true)} />
      )}
    >
      <Menu.Item onPress={() => navigation.navigate('JournalEdit', { journalUid })} icon="edit" title="Edit" />
      <Menu.Item onPress={() => navigation.navigate('JournalMembers', { journalUid })} icon="group" title="Members" />
      <Menu.Item onPress={() => navigation.navigate('Import', { journalUid })} icon="import-export" title="Import" />
    </Menu>
  );
}

JournalEntries.navigationOptions = {
  title: 'Change Journal',
  rightAction: (
    <RightAction />
  ),
};

export default JournalEntries;
