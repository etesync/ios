import * as React from 'react';
import { connect } from 'react-redux';
import { Action } from 'redux-actions';

import * as moment from 'moment';
import 'moment/locale/en-gb';

import { List, Map } from 'immutable';
import { createSelector } from 'reselect';

import LoadingIndicator from './widgets/LoadingIndicator';
import PrettyError from './PrettyError';
import Journals from './components/Journals';

import * as EteSync from './api/EteSync';
import { CURRENT_VERSION } from './api/Constants';
import { byte } from './api/Helpers';

import { store, SettingsType, JournalsType, EntriesType, StoreState, CredentialsData, UserInfoType } from './store';
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo } from './store/actions';

export interface SyncInfoJournal {
  journal: EteSync.Journal;
  derivedJournalKey?: byte[];
  journalEntries: List<EteSync.Entry>;
  collection: EteSync.CollectionInfo;
  entries: List<EteSync.SyncEntry>;
}

export type SyncInfo = Map<string, SyncInfoJournal>;

interface PropsType {
  etesync: CredentialsData;
}

type PropsTypeInner = PropsType & {
  settings: SettingsType;
  journals: JournalsType;
  entries: EntriesType;
  userInfo: UserInfoType;
  fetchCount: number;
};

interface StateType {
  journalMap: Map<string, SyncInfoJournal>;
}

const syncInfoSelector = createSelector(
  (props: PropsTypeInner) => props.etesync,
  (props: PropsTypeInner) => props.journals.value!,
  (props: PropsTypeInner) => props.entries,
  (props: PropsTypeInner) => props.userInfo.value!,
  (etesync, journals, entries, userInfo) => {
    const derived = etesync.encryptionKey;
    let asymmetricCryptoManager: EteSync.AsymmetricCryptoManager;
    try {
      const userInfoCryptoManager = new EteSync.CryptoManager(etesync.encryptionKey, 'userInfo');
      userInfo.verify(userInfoCryptoManager);
    } catch (error) {
      if (error instanceof EteSync.IntegrityError) {
        throw new EteSync.EncryptionPasswordError(error.message);
      } else {
        throw error;
      }
    }
    const keyPair = userInfo.getKeyPair(new EteSync.CryptoManager(derived, 'userInfo', userInfo.version));
    asymmetricCryptoManager = new EteSync.AsymmetricCryptoManager(keyPair);

    return journals.reduce(
      async (promiseRet, journal) => {
        const ret = await promiseRet;
        const journalEntries = entries.get(journal.uid);
        let prevUid: string | null = null;

        if (!journalEntries || !journalEntries.value) {
          return Promise.resolve(ret);
        }

        let cryptoManager: EteSync.CryptoManager;
        let derivedJournalKey: byte[];
        if (journal.key) {
          derivedJournalKey = await asymmetricCryptoManager.decryptBytes(keyPair.privateKey, journal.key);
          cryptoManager = EteSync.CryptoManager.fromDerivedKey(derivedJournalKey, journal.version);
        } else {
          cryptoManager = new EteSync.CryptoManager(derived, journal.uid, journal.version);
        }

        const collectionInfo = journal.getInfo(cryptoManager);

        const syncEntries = journalEntries.value.map((entry: EteSync.Entry) => {
          const syncEntry = entry.getSyncEntry(cryptoManager, prevUid);
          prevUid = entry.uid;

          return syncEntry;
        });

        return Promise.resolve(ret.set(journal.uid, {
          entries: syncEntries,
          collection: collectionInfo,
          journal,
          derivedJournalKey,
          journalEntries: journalEntries.value,
        }));
      },
      Promise.resolve(Map<string, SyncInfoJournal>())
    );
  }
);

class SyncGate extends React.PureComponent<PropsTypeInner, StateType> {
  constructor(props: PropsTypeInner) {
    super(props);

    this.state = {
      journalMap: null as Map<string, SyncInfoJournal>,
    };
  }

  public componentDidMount() {
    const me = this.props.etesync.credentials.email;
    const syncAll = async () => {
      store.dispatch<any>(fetchAll(this.props.etesync, this.props.entries)).then(async (haveJournals: boolean) => {
        if (haveJournals) {
          this.setState({
            journalMap: await syncInfoSelector(this.props),
          });
          return;
        }

        ['ADDRESS_BOOK', 'CALENDAR', 'TASKS'].forEach((collectionType) => {
          const collection = new EteSync.CollectionInfo();
          collection.uid = EteSync.genUid();
          collection.type = collectionType;
          collection.displayName = 'Default';

          const journal = new EteSync.Journal();
          const cryptoManager = new EteSync.CryptoManager(this.props.etesync.encryptionKey, collection.uid);
          journal.setInfo(cryptoManager, collection);
          store.dispatch<any>(addJournal(this.props.etesync, journal)).then(
            (journalAction: Action<EteSync.Journal>) => {
              // FIXME: Limit based on error code to only do it for associates.
              if (!journalAction.error) {
                store.dispatch(fetchEntries(this.props.etesync, collection.uid));
              }
          });
        });
      });
    };

    const sync = async () => {
      if (this.props.userInfo.value) {
        syncAll();
      } else {
        const userInfo = new EteSync.UserInfo(me, CURRENT_VERSION);
        const keyPair = await EteSync.AsymmetricCryptoManager.generateKeyPair();
        const cryptoManager = new EteSync.CryptoManager(this.props.etesync.encryptionKey, 'userInfo');

        userInfo.setKeyPair(cryptoManager, keyPair);

        store.dispatch<any>(createUserInfo(this.props.etesync, userInfo)).then(syncAll);
      }
    };

    if (this.props.userInfo.value) {
      syncAll();
    } else {
      const fetching = store.dispatch(fetchUserInfo(this.props.etesync, me)) as any;
      fetching.then(sync);
    }
  }

  public async componentDidUpdate(prevProps: PropsTypeInner) {
    const journals = this.props.journals.value;

    if ((journals !== null)
      && ((prevProps.journals !== this.props.journals)
        || (prevProps.entries !== this.props.entries))) {

      this.setState({
        journalMap: await syncInfoSelector(this.props),
      });
    }
  }

  public render() {
    const entryArrays = this.props.entries;
    const journals = this.props.journals.value;
    const { journalMap } = this.state;

    if (this.props.userInfo.error) {
      return <PrettyError error={this.props.userInfo.error} />;
    } else if (this.props.journals.error) {
      return <PrettyError error={this.props.journals.error} />;
    } else {
      const errors: Array<{journal: string, error: Error}> = [];
      this.props.entries.forEach((entry, journal) => {
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

    if ((this.props.userInfo.value === null) || (journals === null) || (journalMap === null) ||
      ((this.props.fetchCount > 0) &&
        ((entryArrays.size === 0) || !entryArrays.every((x: any) => (x.value !== null))))
      ) {
      return (<LoadingIndicator />);
    }

    // FIXME: Shouldn't be here
    moment.locale(this.props.settings.locale);

    return (
      <Journals
        etesync={this.props.etesync}
        userInfo={this.props.userInfo.value!}
        syncInfo={journalMap}
      />
    );
  }
}

const mapStateToProps = (state: StoreState, props: PropsType) => {
  return {
    settings: state.settings,
    journals: state.cache.journals,
    entries: state.cache.entries,
    userInfo: state.cache.userInfo,
    fetchCount: state.fetchCount,
  };
};

// FIXME: this and withRouters are only needed here because of https://github.com/ReactTraining/react-router/issues/5795
export default connect(
  mapStateToProps
)(SyncGate);
