import * as React from 'react';
import { ScrollView } from 'react-native';
import { List } from 'react-native-paper';

// import AppBarOverride from '../widgets/AppBarOverride';
const AppBarOverride = (props: any) => <></>;
import Container from '../widgets/Container';

import * as EteSync from '../api/EteSync';

import { JournalsData, UserInfoData, CredentialsData } from '../store';

class Journals extends React.PureComponent {
  public props: {
    etesync: CredentialsData;
    journals: JournalsData;
    userInfo: UserInfoData;
  };

  constructor(props: any) {
    super(props);
    this.journalClicked = this.journalClicked.bind(this);
  }

  public render() {
    const derived = this.props.etesync.encryptionKey;
    let asymmetricCryptoManager: EteSync.AsymmetricCryptoManager;
    const journalMap = this.props.journals.reduce(
      (ret, journal) => {
        let cryptoManager: EteSync.CryptoManager;
        if (journal.key) {
          if (!asymmetricCryptoManager) {
            const userInfo = this.props.userInfo;
            const keyPair = userInfo.getKeyPair(new EteSync.CryptoManager(derived, 'userInfo', userInfo.version));
            asymmetricCryptoManager = new EteSync.AsymmetricCryptoManager(keyPair);
          }
          const derivedJournalKey = asymmetricCryptoManager.decryptBytes(journal.key);
          cryptoManager = EteSync.CryptoManager.fromDerivedKey(derivedJournalKey, journal.version);
        } else {
          cryptoManager = new EteSync.CryptoManager(derived, journal.uid, journal.version);
        }
        const info = journal.getInfo(cryptoManager);
        ret[info.type] = ret[info.type] || [];
        ret[info.type].push(
          <List.Item
            key={journal.uid}
            onClick={() => this.journalClicked(journal.uid)}
            title={`${info.displayName} (${journal.uid.slice(0, 5)})`}
          />
        );

        return ret;
      },
      { CALENDAR: [],
        ADDRESS_BOOK: [],
        TASKS: [],
      });

    return (
      <Container>
        <AppBarOverride title="Journals">
          <></>
        </AppBarOverride>
        <ScrollView style={{ flex: 1 }}>
          <List.Section>
            <List.Subheader>Address Books</List.Subheader>
            {journalMap.ADDRESS_BOOK}
          </List.Section>

          <List.Section>
            <List.Subheader>Calendars</List.Subheader>
            {journalMap.CALENDAR}
          </List.Section>

          <List.Section>
            <List.Subheader>Tasks</List.Subheader>
            {journalMap.TASKS}
          </List.Section>
        </ScrollView>
      </Container>
    );
  }

  private journalClicked(journalUid: string) {
    // this.props.history.push(routeResolver.getRoute('journals._id', { journalUid }));
  }
}

export default Journals;
