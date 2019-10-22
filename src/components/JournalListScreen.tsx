import * as React from 'react';
import { useSelector } from 'react-redux';
import { ScrollView } from 'react-native';
import { Avatar, IconButton, Card, Menu, List } from 'react-native-paper';
import { useNavigation } from '../navigation/Hooks';
import { useTheme } from '../hacks/theme';

import { colorIntToHtml } from '../helpers';

import ColorBox from '../widgets/ColorBox';
import { useSyncGate } from '../SyncGate';

import { StoreState } from '../store';


const JournalsMoreMenu = React.memo(function _JournalsMoreMenu(props: { journalType: string }) {
  const [showMenu, setShowMenu] = React.useState(false);
  const navigation = useNavigation();
  const theme = useTheme();

  return (
    <Menu
      visible={showMenu}
      onDismiss={() => setShowMenu(false)}
      anchor={(
        <IconButton color="white" theme={{ colors: { primary: theme.colors.primaryBackground } }} {...props} icon="more-horiz" onPress={() => setShowMenu(true)} />
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
  const navigation = useNavigation();
  const theme = useTheme();
  const syncGate = useSyncGate();
  const { syncInfoCollections } = useSelector(
    (state: StoreState) => ({
      syncInfoCollections: state.cache.syncInfoCollection,
    })
  );

  if (syncGate) {
    return syncGate;
  }

  const journalMap = syncInfoCollections.reduce(
    (ret, syncInfoCollection) => {
      const info = syncInfoCollection;

      function journalClicked() {
        navigation.navigate('Journal', { journalUid: info.uid });
      }

      let rightIcon: any;
      switch (info.type) {
        case 'CALENDAR':
        case 'TASKS':
          rightIcon = (props: any) => (
            <ColorBox {...props} size={36} color={colorIntToHtml(info.color)} />
          );
          break;
      }

      ret[info.type] = ret[info.type] || [];
      ret[info.type].push(
        <List.Item
          key={info.uid}
          onPress={journalClicked}
          title={`${info.displayName} (${info.uid.slice(0, 5)})`}
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
      icon: 'group',
    },
    {
      title: 'Calendars',
      lookup: 'CALENDAR',
      icon: 'today',
    },
    {
      title: 'Tasks',
      lookup: 'TASKS',
      icon: 'list',
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
      {cards.map((card) => (
        <Card key={card.lookup} elevation={4} style={{ margin: 20 }}>
          <Card.Title
            title={card.title}
            titleStyle={{ color: 'white' }}
            style={{ ...shadowStyle, backgroundColor: theme.colors.primaryBackground}}
            left={(props) => <Avatar.Icon color="white" theme={{ colors: { primary: theme.colors.primaryBackground } }} {...props} icon={card.icon} />}
            right={(props) => (
              <JournalsMoreMenu journalType={card.lookup} />
            )}
          />
          {journalMap[card.lookup]}
        </Card>
      ))}
    </ScrollView>
  );
}
