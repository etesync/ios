import * as React from 'react';
import { Appbar } from 'react-native-paper';
import { HeaderProps } from 'react-navigation';
import { useSelector } from 'react-redux';

import { StoreState } from './store';
import { SyncManager } from './sync/SyncManager';
import { useCredentials } from './login';

interface PropsType extends HeaderProps {
  home?: boolean;
}

const mapStateToStoreProps = (state: StoreState) => {
  return {
    fetchCount: state.fetchCount,
  };
};

const AppHeader = React.memo(function _AppHeader(props: PropsType) {
  const etesync = useCredentials().value;
  const { navigation } = props;
  const { fetchCount } = useSelector(mapStateToStoreProps);

  const backAction = (props.home) ? (
    <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} />
    ) : (
    <Appbar.BackAction onPress={() => navigation.goBack()} />
  );

  function refresh() {
    const syncManager = SyncManager.getManager(etesync);
    syncManager.fetchAllJournals();
  }

  return (
    <Appbar.Header>
      {backAction}
      <Appbar.Content title={getHeaderTitleString(props.scene)} />
      { props.home &&
        <Appbar.Action icon="refresh" disabled={fetchCount > 0} onPress={refresh} />
      }
    </Appbar.Header>
  );
});

// From react-navigation
function getHeaderTitleString(scene: any) {
  const options = scene.descriptor.options;
  if (typeof options.headerTitle === 'string') {
    return options.headerTitle;
  }

  if (options.title && typeof options.title !== 'string' && __DEV__) {
    throw new Error(
      `Invalid title for route "${
        scene.route.routeName
      }" - title must be string or null, instead it was of type ${typeof options.title}`
    );
  }

  return options.title;
}

export default AppHeader;
