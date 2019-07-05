import * as React from 'react';
import * as sjcl from 'sjcl';
import * as Permissions from 'expo-permissions';
import { Text } from 'react-native-paper';

import { CredentialsData } from '../store';

import { SyncManager } from '.';

interface PropsType {
  etesync: CredentialsData;
}

// FIXME XXX FIXME: This is just a hack until we get real randomness going.
sjcl.random.setDefaultParanoia(0, 'Setting paranoia=0 will ruin your security; use it only for testing');

class SyncTempComponent extends React.PureComponent<PropsType> {
  public async componentDidMount() {
    const { etesync } = this.props;
    const syncManager = SyncManager.getManager(etesync);
    console.log('Asking for permissions');
    Permissions.askAsync(Permissions.CALENDAR, Permissions.REMINDERS, Permissions.CONTACTS).then(async () => {
      await syncManager.sync();
    });
  }

  public render() {
    return <Text>Syncer</Text>;
  }
}

export default SyncTempComponent;
