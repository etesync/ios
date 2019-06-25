import * as React from 'react';
import { connect } from 'react-redux';
import { Permissions } from 'expo';
import { Text } from 'react-native-paper';

import { SyncInfo } from '../SyncGate';

import { StoreState, CredentialsData, SyncStateJournalData, SyncStateEntryData } from '../store';

import { SyncManagerCalendar as SyncManager } from '.';

interface PropsType {
  etesync: CredentialsData;
  syncInfo: SyncInfo;
}

type PropsTypeInner = PropsType & {
  syncStateJournals: SyncStateJournalData;
  syncStateEntries: SyncStateEntryData;
};

class SyncTempComponent extends React.PureComponent<PropsTypeInner> {
  constructor(props: PropsTypeInner) {
    super(props);
  }

  public async componentDidMount() {
    const { etesync, syncInfo, syncStateJournals, syncStateEntries } = this.props;
    const syncManager = new SyncManager(etesync);
    console.log('Asking for permissions');
    Permissions.askAsync(Permissions.CALENDAR, Permissions.REMINDERS, Permissions.CONTACTS).then(async () => {
      console.log('Syncing');
      await syncManager.init();
      await syncManager.sync(syncInfo, syncStateJournals, syncStateEntries);
    });
  }

  public render() {
    return <Text>Syncer</Text>;
  }
}

const mapStateToProps = (state: StoreState, props: PropsType) => {
  return {
    syncStateJournals: state.sync.stateJournals,
    syncStateEntries: state.sync.stateEntries,
  };
};

export default connect(
  mapStateToProps
)(SyncTempComponent);
