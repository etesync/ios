import * as React from 'react';
import * as EteSync from '../api/EteSync';
import * as sjcl from 'sjcl';
import { connect } from 'react-redux';
import * as Permissions from 'expo-permissions';
import { Text } from 'react-native-paper';

import { SyncInfo } from '../SyncGate';

import { StoreState, CredentialsData, SyncStateJournalData, SyncStateEntryData } from '../store';

import { SyncManager } from '.';

interface PropsType {
  etesync: CredentialsData;
  userInfo: EteSync.UserInfo;
  syncInfo: SyncInfo;
}

type PropsTypeInner = PropsType & {
  syncStateJournals: SyncStateJournalData;
  syncStateEntries: SyncStateEntryData;
};

// FIXME XXX FIXME: This is just a hack until we get real randomness going.
sjcl.random.setDefaultParanoia(0, 'Setting paranoia=0 will ruin your security; use it only for testing');

class SyncTempComponent extends React.PureComponent<PropsTypeInner> {
  constructor(props: PropsTypeInner) {
    super(props);
  }

  public async componentDidMount() {
    const { etesync, syncInfo, syncStateJournals, syncStateEntries } = this.props;
    const syncManager = SyncManager.getManager(etesync);
    console.log('Asking for permissions');
    Permissions.askAsync(Permissions.CALENDAR, Permissions.REMINDERS, Permissions.CONTACTS).then(async () => {
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
