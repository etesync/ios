import * as React from 'react';
import { Text } from 'react-native-paper';

import { CredentialsData } from '../store';

import { SyncManager } from '.';

interface PropsType {
  etesync: CredentialsData;
}

class SyncTempComponent extends React.PureComponent<PropsType> {
  public async componentDidMount() {
    const { etesync } = this.props;
    const syncManager = SyncManager.getManager(etesync);
    await syncManager.sync();
  }

  public render() {
    return <Text>Syncer</Text>;
  }
}

export default SyncTempComponent;
