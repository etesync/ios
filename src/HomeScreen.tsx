import * as React from 'react';
import { useSelector } from 'react-redux';

import * as moment from 'moment';
import 'moment/locale/en-gb';

import JournalListScreen from './components/JournalListScreen';

import { StoreState } from './store';

import { useCredentials } from './login';
import { useSyncGate } from './SyncGate';
import { useSyncInfo } from './SyncHandler';
export * from './SyncHandler'; // FIXME: Should be granular

import SyncTempComponent from './sync/SyncTestComponent';

const mapStateToStoreProps = (state: StoreState) => {
  return {
    settings: state.settings,
    journals: state.cache.journals,
    entries: state.cache.entries,
    userInfo: state.cache.userInfo,
    fetchCount: state.fetchCount,
  };
};

const HomeScreen = React.memo(function _HomeScreen() {
  const syncInfo = useSyncInfo();
  const etesync = useCredentials().value;
  const { settings, userInfo } = useSelector(mapStateToStoreProps);
  const SyncGate = useSyncGate();

  if (SyncGate) {
    return SyncGate;
  }

  // FIXME: Shouldn't be here
  moment.locale(settings.locale);

  return (
    <>
      <SyncTempComponent
        etesync={etesync}
        userInfo={userInfo.value!}
        syncInfo={syncInfo}
      />
      <JournalListScreen />
    </>
  );
});

export default HomeScreen;
