import * as React from 'react';
import { useSelector } from 'react-redux';

import 'moment/locale/en-gb';

import LoadingIndicator from './widgets/LoadingIndicator';
import PrettyError from './PrettyError';

import { StoreState } from './store';

import { useSyncInfo } from './SyncHandler';
export * from './SyncHandler'; // FIXME: Should be granular

export function useSyncGate() {
  const syncInfo = useSyncInfo();
  const { userInfo, journals, entries } = useSelector(
    (state: StoreState) => ({
      journals: state.cache.journals,
      entries: state.cache.entries,
      userInfo: state.cache.userInfo,
    })
  );

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
