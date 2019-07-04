import * as React from 'react';
import { useSelector } from 'react-redux';

import 'moment/locale/en-gb';

import LoadingIndicator from './widgets/LoadingIndicator';
import PrettyError from './PrettyError';

import { StoreState } from './store';

import { fetchAllJournals } from './sync/SyncManager';
import { useCredentials } from './login';
import { useSyncInfo } from './SyncHandler';
export * from './SyncHandler'; // FIXME: Should be granular

const mapStateToStoreProps = (state: StoreState) => {
  return {
    settings: state.settings,
    journals: state.cache.journals,
    entries: state.cache.entries,
    userInfo: state.cache.userInfo,
    fetchCount: state.fetchCount,
  };
};

export function useSyncGate() {
  const [calledSync, setCalledSync] = React.useState(false);
  const syncInfo = useSyncInfo();
  const etesync = useCredentials().value;
  const { userInfo, journals, entries } = useSelector(mapStateToStoreProps);

  React.useEffect(() => {
    if (calledSync) {
      return;
    }
    setCalledSync(true);
    fetchAllJournals(etesync, entries);
  });


  if (userInfo.error) {
    return <PrettyError error={userInfo.error} />;
  } else if (journals.error) {
    return <PrettyError error={journals.error} />;
  } else {
    const errors: Array<{journal: string, error: Error}> = [];
    entries.forEach((entry, journal) => {
      if (entry.error) {
        errors.push({journal, error: entry.error});
      }
    });

    if (errors.length > 0) {
      return (
        <ul>
          {errors.map((error) => (<li>{error.journal}: {error.error.toString()}</li>))}
        </ul>
      );
    }
  }

  if ((userInfo.value === null) || (journals === null) || (syncInfo === null) || (syncInfo.size === 0)) {
    return (<LoadingIndicator />);
  }

  return null;
}
