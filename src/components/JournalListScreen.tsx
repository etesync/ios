import * as React from 'react';
import { ScrollView } from 'react-native';
import { List } from 'react-native-paper';
import { useNavigation } from '../navigation/Hooks';

import * as EteSync from '../api/EteSync';

import { useSyncInfo } from '../SyncHandler';
import { useCredentials } from '../login';

import { colorIntToHtml } from '../helpers';

import ColorBox from '../widgets/ColorBox';


export default function JournalListScreen() {
  const syncInfo = useSyncInfo();
  const etesync = useCredentials().value;
  const derived = etesync.encryptionKey;
  const navigation = useNavigation();

  if (!syncInfo) {
    return <React.Fragment />;
  }

  const journalMap = syncInfo.reduce(
    (ret, syncInfoJournal) => {
      const { journal, derivedJournalKey } = syncInfoJournal;
      let cryptoManager: EteSync.CryptoManager;
      if (journal.key) {
        cryptoManager = EteSync.CryptoManager.fromDerivedKey(derivedJournalKey, journal.version);
      } else {
        cryptoManager = new EteSync.CryptoManager(derived, journal.uid, journal.version);
      }

      const info = journal.getInfo(cryptoManager);

      function journalClicked() {
        navigation.navigate('Journal', { journalUid: journal.uid });
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
          key={journal.uid}
          onPress={journalClicked}
          title={`${info.displayName} (${journal.uid.slice(0, 5)})`}
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
    },
    {
      title: 'Calendars',
      lookup: 'CALENDAR',
    },
    {
      title: 'Tasks',
      lookup: 'TASKS',
    },
  ];

  return (
    <ScrollView style={{ flex: 1 }}>
      {cards.map((card) => (
        <List.Section key={card.lookup}>
          <List.Subheader>{card.title}</List.Subheader>
          {journalMap[card.lookup]}
        </List.Section>
      ))}
    </ScrollView>
  );
}
