import * as EteSync from '../api/EteSync';
import { Map as ImmutableMap } from 'immutable';

import { logger } from '../logging';

import { PimType } from '../pim-types';
import { SyncInfo, SyncInfoJournal } from '../SyncGate';
import { store, CredentialsData, SyncStateJournalData, SyncStateEntryData, SyncStateJournal, SyncStateJournalEntryData, SyncStateEntry } from '../store';
import { setSyncStateJournal, unsetSyncStateJournal, setSyncStateEntry, unsetSyncStateEntry } from '../store/actions';
import { NativeBase, entryNativeHashCalc } from './helpers';
import { createJournalEntryFromSyncEntry } from '../etesync-helpers';

/*
 * This class should probably mirror exactly what's done in Android. So it should
 * fetch / push / etc in the same manner.
 * One thing to remember though is not to call it on overy refresh of props
 * (because it will be called more than once), only commit to cache each chunk
 * when processed, and probably lock its sync so it doesn't run on the same user
 * more than once at a time.
 *
 * XXX Will potentially replace sync gate? Maybe combine
 *
 * Need to map between local calendar IDs and EteSync journal UIDs - probably there also keep the lastSyncUid.
 */
// XXX should probably be a singleton, or at least one per user - though maybe should be handled externally
export abstract class SyncManagerBase<T extends PimType, N extends NativeBase> {
  protected etesync: CredentialsData;
  protected userInfo: EteSync.UserInfo;
  protected collectionType: string;
  protected syncStateJournals: SyncStateJournalData;
  protected syncStateEntries: SyncStateEntryData;

  constructor(etesync: CredentialsData, userInfo: EteSync.UserInfo) {
    this.etesync = etesync;
    this.userInfo = userInfo;
  }

  public async init() {
    //
  }

  public async sync(syncInfo: SyncInfo, syncStateJournals: SyncStateJournalData, syncStateEntries: SyncStateEntryData) {
    this.syncStateJournals = syncStateJournals;
    this.syncStateEntries = syncStateEntries;

    if (__DEV__) {
      // await this.clearDeviceCollections(syncInfo);
    }
    logger.info(`Starting sync: ${this.collectionType}`);
    logger.info('Syncing journal list');
    await this.syncJournalList(syncInfo);
    logger.info('Pulling changes');
    await this.syncPull(syncInfo);
    logger.info('Pushing changes');
    await this.syncPush(syncInfo);
    logger.info(`Finished sync: ${this.collectionType}`);
  }

  protected async syncJournalList(syncInfo: SyncInfo) {
    const etesync = this.etesync;
    const syncStateJournals = this.syncStateJournals.asMutable();
    const currentJournals = [] as SyncStateJournal[];
    const notOurs = new Map<string, boolean>();

    for (const syncJournal of syncInfo.values()) {
      const collection = syncJournal.collection;
      const uid = collection.uid;

      if (syncJournal.collection.type !== this.collectionType) {
        notOurs.set(uid, true);
        continue;
      }

      let syncStateJournal = syncStateJournals.get(uid);
      let localId: string;
      if (syncStateJournals.has(uid)) {
        // FIXME: only modify if changed!
        logger.info(`Updating ${uid}`);
        localId = syncStateJournals.get(uid).localId;
        await this.updateJournal(localId, syncJournal);
        syncStateJournals.delete(uid);
      } else {
        logger.info(`Creating ${uid}`);
        localId = await this.createJournal(syncJournal);

        syncStateJournal = {
          localId,
          uid,
          lastSyncUid: null,
        };
        store.dispatch(setSyncStateJournal(etesync, syncStateJournal));
      }

      currentJournals.push(syncStateJournal);
    }

    // Remove deleted calendars
    await Promise.all(syncStateJournals.map(async (oldJournal) => {
      if (!notOurs.has(oldJournal.uid)) {
        logger.info(`Deleting ${oldJournal.uid}`);
        await this.deleteJournal(oldJournal.localId);
        syncStateJournals.delete(oldJournal.uid);
        store.dispatch(unsetSyncStateJournal(etesync, oldJournal));
      }
      return true;
    }));

    syncStateJournals.clear();

    currentJournals.forEach((syncStateJournal) => {
      syncStateJournals.set(syncStateJournal.uid, syncStateJournal);
    });

    this.syncStateJournals = syncStateJournals.asImmutable();
  }

  protected async syncPull(syncInfo: SyncInfo) {
    // FIXME: Sholud alert beforehand if local is not enable and only iCloud is and let people know, and if that the case, use iCloud if there's no local.
    // See notes for more info
    const etesync = this.etesync;
    const syncStateJournals = this.syncStateJournals;
    const syncStateEntriesAll = this.syncStateEntries.asMutable();

    for (const syncJournal of syncInfo.values()) {
      if (syncJournal.collection.type !== this.collectionType) {
        continue;
      }

      const collection = syncJournal.collection;
      const uid = collection.uid;
      logger.info(`Pulling ${uid}`);

      const journalSyncEntries = (syncStateEntriesAll.get(uid) || ImmutableMap({})).asMutable();

      const syncStateJournal = syncStateJournals.get(uid);
      const localId = syncStateJournals.get(uid).localId;

      const entries = syncJournal.entries;
      const lastEntry: EteSync.SyncEntry = entries.last();
      if (lastEntry && (lastEntry.uid !== syncStateJournal.lastSyncUid)) {
        logger.info(`Applying changes. Current uid: ${lastEntry.uid}, last one: ${syncStateJournal.lastSyncUid}`);
        const lastSyncUid = syncStateJournal.lastSyncUid;

        let firstEntry: number;
        if (lastSyncUid === null) {
          firstEntry = 0;
        } else {
          const lastEntryPos = entries.findIndex((entry) => {
            return entry.uid === lastSyncUid;
          });

          if (lastEntryPos === -1) {
            throw Error('Could not find last sync entry!');
          }
          firstEntry = lastEntryPos + 1;
        }

        for (let i = firstEntry ; i < entries.size ; i++) {
          const syncEntry: EteSync.SyncEntry = entries.get(i);
          const syncStateEntry = await this.processSyncEntry(localId, syncEntry, journalSyncEntries);
          switch (syncEntry.action) {
            case EteSync.SyncEntryAction.Add:
            case EteSync.SyncEntryAction.Change:
              journalSyncEntries.set(syncStateEntry.uid, syncStateEntry);
              store.dispatch(setSyncStateEntry(etesync, uid, syncStateEntry));
              break;
            case EteSync.SyncEntryAction.Delete:
              if (syncStateEntry) {
                journalSyncEntries.delete(syncStateEntry.uid);
                store.dispatch(unsetSyncStateEntry(etesync, uid, syncStateEntry));
              }
              break;
          }
        }
        // FIXME: probably do in chunks
        syncStateJournal.lastSyncUid = lastEntry.uid;
        store.dispatch(setSyncStateJournal(etesync, syncStateJournal));

        syncStateEntriesAll.set(uid, journalSyncEntries.asImmutable());
      }
    }

    this.syncStateEntries = syncStateEntriesAll.asImmutable();
  }

  protected pushJournalEntries(syncJournal: SyncInfoJournal, syncEntries: EteSync.SyncEntry[]) {
    if (syncEntries.length > 0) {
      let prevUid: string | null = null;
      const last = syncJournal.journalEntries.last() as EteSync.Entry;
      if (last) {
        prevUid = last.uid;
      }
      const journalEntries = syncEntries.map((syncEntry) => {
        const ret = createJournalEntryFromSyncEntry(this.etesync, this.userInfo, syncJournal.journal, prevUid, syncEntry);
        prevUid = ret.uid;
        return ret;
      });

      console.log(journalEntries.map((ent) => (ent.uid)));
    }
  }

  protected syncPushHandleAddChange(syncJournal: SyncInfoJournal, syncStateEntry: SyncStateEntry, nativeItem: N) {
    if (syncStateEntry === undefined) {
      // New
      const vobjectEvent = this.nativeToVobject(nativeItem);
      const syncEntry = new EteSync.SyncEntry();
      logger.info(`New entry ${nativeItem.uid}`);
      syncEntry.action = EteSync.SyncEntryAction.Add;
      syncEntry.content = vobjectEvent.toIcal();
      return syncEntry;
    } else {
      const currentHash = entryNativeHashCalc(nativeItem);
      if (currentHash !== syncStateEntry.lastHash) {
        // Changed
        logger.info(`Changed entry ${nativeItem.uid}`);
        const vobjectEvent = this.nativeToVobject(nativeItem);
        const syncEntry = new EteSync.SyncEntry();
        syncEntry.action = EteSync.SyncEntryAction.Change;
        syncEntry.content = vobjectEvent.toIcal();
        return syncEntry;
      }
    }

    return null;
  }

  protected syncPushHandleDeleted(syncJournal: SyncInfoJournal, syncStateEntry: SyncStateEntry) {
    logger.info(`Deleted entry ${syncStateEntry.uid}`);
    const syncEntry = new EteSync.SyncEntry();
    syncEntry.action = EteSync.SyncEntryAction.Delete;
    for (const entry of syncJournal.entries.reverse()) {
      const pimItem = this.syncEntryToVobject(entry);
      if (pimItem.uid === syncStateEntry.uid) {
        syncEntry.content = pimItem.toIcal();
        return syncEntry;
      }
    }

    return null;
  }

  protected abstract async createJournal(syncJournal: SyncInfoJournal): Promise<string>;
  protected abstract async updateJournal(containerLocalId: string, syncJournal: SyncInfoJournal): Promise<void>;
  protected abstract async deleteJournal(containerLocalId: string): Promise<void>;
  protected abstract async syncPush(syncInfo: SyncInfo): Promise<void>;

  protected abstract syncEntryToVobject(syncEntry: EteSync.SyncEntry): T;
  protected abstract nativeToVobject(nativeItem: N): T;

  protected abstract async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateJournalEntryData): Promise<SyncStateEntry>;

  protected abstract async clearDeviceCollections(syncInfo: SyncInfo): Promise<void>;
}
