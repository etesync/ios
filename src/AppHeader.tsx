import * as React from 'react';
import { Appbar } from 'react-native-paper';
import { useNavigation } from './navigation/Hooks';
import { useSelector } from 'react-redux';

import { StoreState } from './store';
import { fetchAllJournals } from './sync/SyncManager';
import { useCredentials } from './login';

import * as C from './constants';

interface PropsType {
  home?: boolean;
}

const mapStateToStoreProps = (state: StoreState) => {
  return {
    entries: state.cache.entries,
    fetchCount: state.fetchCount,
  };
};

const AppHeader = React.memo(function _AppHeader(props: PropsType) {
  const navigation = useNavigation();
  const etesync = useCredentials().value;
  const { fetchCount, entries } = useSelector(mapStateToStoreProps);

  const backAction = (props.home) ? (
    <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} />
    ) : (
    <Appbar.BackAction onPress={() => navigation.goBack()} />
  );

  function refresh() {
    fetchAllJournals(etesync, entries);
  }

  return (
    <Appbar.Header>
      {backAction}
      <Appbar.Content title={C.appName} />
      { props.home &&
        <Appbar.Action icon="refresh" disabled={fetchCount > 0} onPress={refresh} />
      }
    </Appbar.Header>
  );
});

export default AppHeader;
