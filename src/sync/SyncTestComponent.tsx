import * as React from 'react';
import * as sjcl from 'sjcl';
import * as Permissions from 'expo-permissions';
import { Text } from 'react-native-paper';

import * as Random from 'expo-random';

import { CredentialsData } from '../store';

import { SyncManager } from '.';

interface PropsType {
  etesync: CredentialsData;
}

// XXX Set the entropy
// FIXME: probably add it every few hours? Every sync actually.
(async () => {
  const entropyBits = 1024;
  const bytes = await Random.getRandomBytesAsync(entropyBits / 8);
  const buf = new Uint32Array(new Uint8Array(bytes).buffer);
  sjcl.random.addEntropy(buf as any, entropyBits, 'Random.getRandomBytesAsync');
})();

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
