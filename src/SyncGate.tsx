import * as React from 'react';
import { useSelector } from 'react-redux';
import { Action } from 'redux-actions';

import * as moment from 'moment';
import 'moment/locale/en-gb';

import LoadingIndicator from './widgets/LoadingIndicator';
import PrettyError from './PrettyError';
import Journals from './components/Journals';

import * as EteSync from './api/EteSync';
import { CURRENT_VERSION } from './api/Constants';

import { store, StoreState, CredentialsData, UserInfoType, EntriesType } from './store';
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo } from './store/actions';

import { useCredentials } from './login';
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

function syncAllJournals(etesync: CredentialsData, userInfo: UserInfoType, entries: EntriesType) {
  const me = etesync.credentials.email;
  const syncAll = async () => {
    store.dispatch<any>(fetchAll(etesync, entries)).then(async (haveJournals: boolean) => {
      if (haveJournals) {
        return;
      }

      ['ADDRESS_BOOK', 'CALENDAR', 'TASKS'].forEach((collectionType) => {
        const collection = new EteSync.CollectionInfo();
        collection.uid = EteSync.genUid();
        collection.type = collectionType;
        collection.displayName = 'Default';

        const journal = new EteSync.Journal();
        const cryptoManager = new EteSync.CryptoManager(etesync.encryptionKey, collection.uid);
        journal.setInfo(cryptoManager, collection);
        store.dispatch<any>(addJournal(etesync, journal)).then(
          (journalAction: Action<EteSync.Journal>) => {
            // FIXME: Limit based on error code to only do it for associates.
            if (!journalAction.error) {
              store.dispatch(fetchEntries(etesync, collection.uid));
            }
          });
      });
    });
  };

  const sync = async () => {
    if (userInfo.value) {
      syncAll();
    } else {
      const newUserInfo = new EteSync.UserInfo(me, CURRENT_VERSION);
      const keyPair = await EteSync.AsymmetricCryptoManager.generateKeyPair();
      const cryptoManager = new EteSync.CryptoManager(etesync.encryptionKey, 'userInfo');

      newUserInfo.setKeyPair(cryptoManager, keyPair);

      store.dispatch<any>(createUserInfo(etesync, newUserInfo)).then(syncAll);
    }
  };

  if (userInfo.value) {
    syncAll();
  } else {
    const fetching = store.dispatch(fetchUserInfo(etesync, me)) as any;
    fetching.then(sync);
  }
}

const SyncGate = React.memo(function _SyncGate() {
  const [calledSync, setCalledSync] = React.useState(false);
  const syncInfo = useSyncInfo();
  const etesync = useCredentials().value;
  const { settings, userInfo, journals, entries } = useSelector(mapStateToStoreProps);

  React.useEffect(() => {
    if (calledSync) {
      return;
    }
    setCalledSync(true);
    syncAllJournals(etesync, userInfo, entries);
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

  // FIXME: Shouldn't be here
  moment.locale(settings.locale);

  return (
    <>
      <SyncTempComponent
        etesync={etesync}
        userInfo={userInfo.value!}
        syncInfo={syncInfo}
      />
      <Journals
        etesync={etesync}
        userInfo={userInfo.value!}
        syncInfo={syncInfo}
      />
    </>
  );
});

export default SyncGate;
