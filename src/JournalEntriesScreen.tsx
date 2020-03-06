// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import { FlatList, View } from 'react-native';
import { Menu, Divider, Appbar, Text, List, useTheme } from 'react-native-paper';
import { useNavigation, RouteProp } from '@react-navigation/native';

import { useSyncGate } from './SyncGate';
import { StoreState } from './store';
import Container from './widgets/Container';
import { Title } from './widgets/Typography';

import { TaskType, EventType, ContactType, parseString } from './pim-types';

import * as EteSync from 'etesync';
import { isDefined, colorIntToHtml } from './helpers';

import ColorBox from './widgets/ColorBox';

const listIcons = {
  [EteSync.SyncEntryAction.Add]: (props: any) => (<List.Icon {...props} color="#16B14B" icon="plus" />),
  [EteSync.SyncEntryAction.Change]: (props: any) => (<List.Icon {...props} color="#FEB115" icon="pencil" />),
  [EteSync.SyncEntryAction.Delete]: (props: any) => (<List.Icon {...props} color="#F20C0C" icon="delete" />),
};

type RootStackParamList = {
  JournalEntries: {
    journalUid?: string;
  };
};

interface PropsType {
  route: RouteProp<RootStackParamList, 'JournalEntries'>;
}

export default function JournalEntries(props: PropsType) {
  const navigation = useNavigation();
  const syncGate = useSyncGate();
  const theme = useTheme();
  const syncStateJournals = useSelector((state: StoreState) => state.sync.stateJournals);
  const syncStateEntries = useSelector((state: StoreState) => state.sync.stateEntries);
  const journalEntries = useSelector((state: StoreState) => state.cache.entries);
  const syncInfoCollections = useSelector((state: StoreState) => state.cache.syncInfoCollection);
  const syncInfoEntries = useSelector((state: StoreState) => state.cache.syncInfoItem);

  if (syncGate) {
    return syncGate;
  }

  const journalUid = props.route.params.journalUid ?? '';
  const collection = syncInfoCollections.get(journalUid);
  const entries = journalEntries.get(journalUid);

  if (!collection || !entries) {
    return <Text>Error</Text>;
  }

  const syncEntries = syncInfoEntries.get(journalUid)!;
  const itemCount = syncStateEntries.get(journalUid)?.count();

  function renderEntry(param: { item: EteSync.Entry }) {
    const syncEntry = syncEntries.get(param.item.uid)!;
    const comp = parseString(syncEntry.content);

    const icon = listIcons[syncEntry.action];

    let name;
    let uid: string;
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
        key={syncEntry.uid}
        left={icon}
        title={name}
        description={uid}
        onPress={() => { navigation.navigate('JournalItem', { journalUid, entryUid: syncEntry.uid }) }}
      />
    );
  }

  let collectionColorBox: React.ReactNode;
  switch (collection.type) {
    case 'CALENDAR':
    case 'TASKS':
      collectionColorBox = (
        <ColorBox size={36} color={colorIntToHtml(collection.color)} />
      );
      break;
  }

  function RightAction() {
    const [showMenu, setShowMenu] = React.useState(false);

    return (
      <Menu
        visible={showMenu}
        onDismiss={() => setShowMenu(false)}
        anchor={(
          <Appbar.Action icon="dots-vertical" accessibilityLabel="Menu" onPress={() => setShowMenu(true)} />
        )}
      >
        <Menu.Item icon="pencil" title="Edit"
          onPress={() => {
            setShowMenu(false);
            navigation.navigate('JournalEdit', { journalUid });
          }}
        />
        <Menu.Item icon="account-multiple" title="Members"
          onPress={() => {
            setShowMenu(false);
            navigation.navigate('JournalMembers', { journalUid });
          }}
        />
        {syncStateJournals.has(journalUid) &&
          <Menu.Item icon="import" title="Import"
            onPress={() => {
              setShowMenu(false);
              navigation.navigate('JournalImport', { journalUid });
            }}
          />
        }
      </Menu>
    );
  }

  navigation.setOptions({
    headerRight: () => (
      <RightAction />
    ),
  });

  return (
    <>
      <Container style={{ flexDirection: 'row' }}>
        <View style={{ marginRight: 'auto' }}>
          <Title>{collection.displayName} ({journalUid.slice(0, 5)})</Title>
          <Text>
            {isDefined(itemCount) && `Items: ${itemCount}, `}
            Log entries: {entries.count()}
          </Text>
        </View>
        {collectionColorBox}
      </Container>
      <Divider />
      <FlatList
        style={[{ backgroundColor: theme.colors.background }, { flex: 1 }]}
        data={entries.reverse().toJS()}
        keyExtractor={(_item, idx) => idx.toString()}
        renderItem={renderEntry}
        maxToRenderPerBatch={10}
      />
    </>
  );
}
