import * as React from 'react';
import { NavigationScreenComponent } from 'react-navigation';
import { useSelector } from 'react-redux';
import { useNavigation } from './navigation/Hooks';
import { FlatList, View, ScrollView } from 'react-native';
import { Menu, Divider, Appbar, Title, Text, List } from 'react-native-paper';

import * as ICAL from 'ical.js';

import { useSyncGate } from './SyncGate';
import { StoreState } from './store';
import Container from './widgets/Container';

import { TaskType, EventType, ContactType } from './pim-types';

import * as EteSync from './api/EteSync';
import { colorIntToHtml } from './helpers';

import ColorBox from './widgets/ColorBox';

const listIcons = {
  [EteSync.SyncEntryAction.Add]: (props: any) => (<List.Icon {...props} color="#16B14B" icon="plus" />),
  [EteSync.SyncEntryAction.Change]: (props: any) => (<List.Icon {...props} color="#FEB115" icon="pencil" />),
  [EteSync.SyncEntryAction.Delete]: (props: any) => (<List.Icon {...props} color="#F20C0C" icon="delete" />),
};

const JournalEntries: NavigationScreenComponent = function _JournalEntries() {
  const navigation = useNavigation();
  const syncGate = useSyncGate();
  const { syncStateEntries, journalEntries, syncInfoCollections, syncInfoEntries } = useSelector(
    (state: StoreState) => ({
      syncStateEntries: state.sync.stateEntries,
      journalEntries: state.cache.entries,
      syncInfoCollections: state.cache.syncInfoCollection,
      syncInfoEntries: state.cache.syncInfoItem,
    })
  );

  if (syncGate) {
    return syncGate;
  }

  const journalUid = navigation.getParam('journalUid');
  const collection = syncInfoCollections.get(journalUid);
  const entries = journalEntries.get(journalUid);
  const syncEntries = syncInfoEntries.get(journalUid);
  const itemCount = syncStateEntries.has(journalUid) ?
      syncStateEntries.get(journalUid).count() :
      -1;

  const changeEntries = entries.map((journalEntry, idx) => {
    const syncEntry = syncEntries.get(journalEntry.uid);
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

    return ({
        key: idx.toString(),
        icon,
        title: name,
        description: uid,
        uid: syncEntry.uid,
    });
  }).reverse();

  function renderEntry(param: { item: {key: string, icon: (props: any) => React.ReactNode, title: string, description: string, uid: string } }) {
    const { key, icon, title, description, uid } = param.item;

    return (
      <List.Item
        key={key}
        left={icon}
        title={title}
        description={description}
        onPress={() => navigation.navigate('JournalItem', { journalUid, entryUid: uid })}
      />
    );
  }

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
        <FlatList
          data={changeEntries.toJS()}
          renderItem={renderEntry}
        />
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
        <Appbar.Action icon="dots-vertical" onPress={() => setShowMenu(true)} />
      )}
    >
      <Menu.Item onPress={() => navigation.navigate('JournalEdit', { journalUid })} icon="pencil" title="Edit" />
      <Menu.Item onPress={() => navigation.navigate('JournalMembers', { journalUid })} icon="account-multiple" title="Members" />
      <Menu.Item onPress={() => navigation.navigate('Import', { journalUid })} icon="import" title="Import" />
    </Menu>
  );
}

JournalEntries.navigationOptions = {
  title: 'Journal Entries',
  rightAction: (
    <RightAction />
  ),
};

export default JournalEntries;
