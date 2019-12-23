import * as React from 'react';
import { useSelector } from 'react-redux';
import { View } from 'react-native';
import { Avatar, IconButton, Card, Menu, List, Colors, Text } from 'react-native-paper';
import { useNavigation } from '../navigation/Hooks';

import moment from 'moment';

import { colorIntToHtml } from '../helpers';

import ScrollView from '../widgets/ScrollView';
import ColorBox from '../widgets/ColorBox';
import { useCredentials } from '../login';
import { useSyncGate } from '../SyncGate';

import { StoreState } from '../store';

const backgroundPrimary = Colors.amber700;

const JournalsMoreMenu = React.memo(function _JournalsMoreMenu(props: { journalType: string }) {
  const [showMenu, setShowMenu] = React.useState(false);
  const navigation = useNavigation();

  return (
    <Menu
      visible={showMenu}
      onDismiss={() => setShowMenu(false)}
      anchor={(
        <IconButton color="white" theme={{ colors: { primary: backgroundPrimary } }} {...props} icon="dots-horizontal" onPress={() => setShowMenu(true)} />
      )}
    >
      <Menu.Item
        onPress={() => {
          setShowMenu(false);
          navigation.navigate('JournalNew', { journalType: props.journalType });
        }}
        title="Create new"
      />
    </Menu>
  );
});


export default function JournalListScreen() {
  const etesync = useCredentials()!;
  const navigation = useNavigation();
  const syncGate = useSyncGate();
  const syncInfoCollections = useSelector((state: StoreState) => state.cache.syncInfoCollection);
  const journals = useSelector((state: StoreState) => state.cache.journals);
  const lastSync = useSelector((state: StoreState) => state.sync.lastSync);

  if (syncGate) {
    return syncGate;
  }

  const me = etesync.credentials.email;

  const journalMap = syncInfoCollections.reduce(
    (ret, syncInfoCollection) => {
      const info = syncInfoCollection;
      const journal = journals.get(info.uid)!;
      const shared = journal.owner !== me;

      function journalClicked() {
        navigation.navigate('Journal', { journalUid: info.uid });
      }

      let colorBox: any;
      switch (info.type) {
        case 'CALENDAR':
        case 'TASKS':
          colorBox = (
            <ColorBox size={36} color={colorIntToHtml(info.color)} />
          );
          break;
      }

      const rightIcon = (props: any) => (
        <View {...props} style={{ flexDirection: 'row' }}>
          {shared &&
            <Avatar.Icon icon="account-multiple" size={36} style={{ backgroundColor: 'transparent' }} />
          }
          {journal.readOnly &&
            <Avatar.Icon icon="eye" size={36} style={{ backgroundColor: 'transparent' }} />
          }
          {colorBox}
        </View>
      );

      ret[info.type] = ret[info.type] ?? [];
      ret[info.type].push(
        <List.Item
          key={info.uid}
          onPress={journalClicked}
          title={info.displayName}
          right={rightIcon}
        />
      );

      return ret;
    },
    { CALENDAR: [],
      ADDRESS_BOOK: [],
      TASKS: [],
    } as { [key: string]: React.ReactNode[] }
  );

  const cards = [
    {
      title: 'Address Books',
      lookup: 'ADDRESS_BOOK',
      icon: 'contacts',
    },
    {
      title: 'Calendars',
      lookup: 'CALENDAR',
      icon: 'calendar',
    },
    {
      title: 'Tasks',
      lookup: 'TASKS',
      icon: 'format-list-checkbox',
    },
  ];

  const shadowStyle = {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,

    elevation: 2,
  };

  return (
    <ScrollView style={{ flex: 1 }}>
      <Text style={{ textAlign: 'center', marginTop: 15 }}>Last sync: {lastSync ? moment(lastSync).format('lll') : 'never'}</Text>
      {cards.map((card) => (
        <Card key={card.lookup} elevation={4} style={{ margin: 20 }}>
          <Card.Title
            title={card.title}
            titleStyle={{ color: 'white' }}
            style={{ ...shadowStyle, backgroundColor: backgroundPrimary }}
            left={(props) => <Avatar.Icon color="white" theme={{ colors: { primary: backgroundPrimary } }} {...props} icon={card.icon} />}
            right={() => (
              <JournalsMoreMenu journalType={card.lookup} />
            )}
          />
          {journalMap[card.lookup]}
        </Card>
      ))}
    </ScrollView>
  );
}
