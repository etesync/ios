import * as EteSync from '../api/EteSync';
import { Map as ImmutableMap } from 'immutable';

import { logger } from '../logging';

import { PimType } from '../pim-types';
import { store, persistor, CredentialsData, SyncStateJournalData, SyncStateEntryData, SyncStateJournal, SyncStateJournalEntryData, SyncStateEntry, JournalsData } from '../store';
import { setSyncStateJournal, unsetSyncStateJournal, setSyncStateEntry, unsetSyncStateEntry, addEntries } from '../store/actions';
import { NativeBase } from './helpers';
import { createJournalEntryFromSyncEntry } from '../etesync-helpers';

export const CHUNK_PULL = 30;
export const CHUNK_PUSH = 30;

export interface PushEntry {
  syncEntry: EteSync.SyncEntry;
  syncStateEntry: SyncStateEntry;
}

function* arrayToChunkIterator<T extends any[]>(arr: T, size: number) {
  for (let i = 0 ; i < arr.length ; i += size) {
    yield arr.slice(i, i + size);
  }
}

function persistSyncJournal(etesync: CredentialsData, syncStateJournal: SyncStateJournal, lastUid: string | null) {
  if (lastUid) {
    syncStateJournal.lastSyncUid = lastUid;
  }
  store.dispatch(setSyncStateJournal(etesync, syncStateJournal));

  persistor.persist();
}

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

  // FIXME: Remove these parameters, we should just get them inside.
  public async sync(syncStateJournals: SyncStateJournalData, syncStateEntries: SyncStateEntryData) {
    this.syncStateJournals = syncStateJournals;
    this.syncStateEntries = syncStateEntries;

    if (__DEV__) {
      // await this.clearDeviceCollections();
    }
    logger.info(`Starting sync: ${this.collectionType}`);
    logger.info('Syncing journal list');
    await this.syncJournalList();
    logger.info('Pulling changes');
    await this.syncPull();
    logger.info('Pushing changes');
    await this.syncPush();
    logger.info(`Finished sync: ${this.collectionType}`);
  }

  public abstract async clearDeviceCollections(): Promise<void>;

  protected async syncJournalList() {
    const etesync = this.etesync;
    const syncStateJournals = this.syncStateJournals.asMutable();
    const storeState = store.getState();
    const syncInfoCollections = storeState.cache.syncInfoCollection;
    const currentJournals = [] as SyncStateJournal[];
    const notOurs = new Map<string, boolean>();

    for (const collection of syncInfoCollections.values()) {
      const uid = collection.uid;

      if (collection.type !== this.collectionType) {
        notOurs.set(uid, true);
        continue;
      }

      let syncStateJournal = syncStateJournals.get(uid)!;
      let localId: string;
      if (syncStateJournals.has(uid)) {
        // FIXME: only modify if changed!
        logger.info(`Updating ${uid}`);
        localId = syncStateJournal.localId;
        await this.updateJournal(localId, collection);
        syncStateJournals.delete(uid);
      } else {
        logger.info(`Creating ${uid}`);
        localId = await this.createJournal(collection);

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

  protected async syncPull() {
    const storeState = store.getState();
    const journalsEntries = storeState.cache.entries;
    const syncInfoCollections = storeState.cache.syncInfoCollection;
    const syncInfoItems = storeState.cache.syncInfoItem;
    // FIXME: Sholud alert beforehand if local is not enable and only iCloud is and let people know, and if that the case, use iCloud if there's no local.
    // See notes for more info
    const etesync = this.etesync;
    const syncStateJournals = this.syncStateJournals;
    const syncStateEntriesAll = this.syncStateEntries.asMutable();

    for (const collection of syncInfoCollections.values()) {
      const uid = collection.uid;

      if (collection.type !== this.collectionType) {
        continue;
      }

      logger.info(`Pulling ${uid}`);

      const journalSyncEntries = (syncStateEntriesAll.get(uid) ?? ImmutableMap({})).asMutable();

      const syncStateJournal = syncStateJournals.get(uid)!;
      const localId = syncStateJournal.localId;

      const syncInfoJournalItems = syncInfoItems.get(uid)!;
      const entries = journalsEntries.get(uid)!.map((entry) => syncInfoJournalItems.get(entry.uid)!);
      const lastEntry: EteSync.SyncEntry = entries.last();
      if (lastEntry?.uid !== syncStateJournal.lastSyncUid) {
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
          const syncEntry: EteSync.SyncEntry = entries.get(i)!;
          const syncStateEntry = await this.processSyncEntry(localId, syncEntry, journalSyncEntries);
          switch (syncEntry.action) {
            case EteSync.SyncEntryAction.Add:
            case EteSync.SyncEntryAction.Change: {
              journalSyncEntries.set(syncStateEntry.uid, syncStateEntry);
              store.dispatch(setSyncStateEntry(etesync, uid, syncStateEntry));
              break;
            }
            case EteSync.SyncEntryAction.Delete: {
              if (syncStateEntry) {
                journalSyncEntries.delete(syncStateEntry.uid);
                store.dispatch(unsetSyncStateEntry(etesync, uid, syncStateEntry));
              }
              break;
            }
          }

          if (((i === entries.size - 1) || (i % CHUNK_PULL) === 0)) {
            persistSyncJournal(etesync, syncStateJournal, lastEntry.uid!);
          }
        }

        syncStateEntriesAll.set(uid, journalSyncEntries.asImmutable());
      }
    }

    this.syncStateEntries = syncStateEntriesAll.asImmutable();
  }

  protected async pushJournalEntries(pSyncStateJournal: SyncStateJournal, pushEntries: PushEntry[]) {
    if (pushEntries.length > 0) {
      const etesync = this.etesync;
      const storeState = store.getState();
      const journals = storeState.cache.journals as JournalsData;
      const syncStateJournal = { ...pSyncStateJournal };

      const journalUid = syncStateJournal.uid;
      let prevUid: string | null = syncStateJournal.lastSyncUid;
      let lastSyncUid: string | null = prevUid;

      for (const pushChunk of arrayToChunkIterator(pushEntries, CHUNK_PUSH)) {
        const journalEntries = pushChunk.map((pushEntry) => {
          const ret = createJournalEntryFromSyncEntry(this.etesync, this.userInfo, journals.get(journalUid)!, prevUid, pushEntry.syncEntry);
          prevUid = ret.uid;

          return ret;
        });

        await store.dispatch(addEntries(etesync, journalUid, journalEntries, lastSyncUid));

        for (const pushEntry of pushChunk) {
          switch (pushEntry.syncEntry.action) {
            case EteSync.SyncEntryAction.Add:
            case EteSync.SyncEntryAction.Change: {
              store.dispatch(setSyncStateEntry(etesync, journalUid, pushEntry.syncStateEntry));
              break;
            }
            case EteSync.SyncEntryAction.Delete: {
              store.dispatch(unsetSyncStateEntry(etesync, journalUid, pushEntry.syncStateEntry));
              break;
            }
          }
        }

        lastSyncUid = journalEntries[journalEntries.length - 1].uid;
        persistSyncJournal(etesync, syncStateJournal, lastSyncUid!);
      }
    }
  }

  protected syncPushHandleAddChange(_syncStateJournal: SyncStateJournal, syncStateEntry: SyncStateEntry | undefined, nativeItem: N) {
    let syncEntryAction: EteSync.SyncEntryAction | undefined;
    const currentHash = this.nativeHashCalc(nativeItem);

    if (syncStateEntry === undefined) {
      // New
      logger.info(`New entry ${nativeItem.uid}`);
      syncEntryAction = EteSync.SyncEntryAction.Add;
    } else {
      if (currentHash !== syncStateEntry.lastHash) {
        // Changed
        logger.info(`Changed entry ${nativeItem.uid}`);
        syncEntryAction = EteSync.SyncEntryAction.Change;
      }
    }

    if (syncEntryAction) {
      const vobjectEvent = this.nativeToVobject(nativeItem);
      const syncEntry = new EteSync.SyncEntry();
      syncEntry.action = syncEntryAction;
      syncEntry.content = vobjectEvent.toIcal();

      syncStateEntry = {
        uid: nativeItem.uid,
        localId: nativeItem.id!,
        lastHash: currentHash,
      };

      return { syncEntry, syncStateEntry };
    }

    return null;
  }

  protected syncPushHandleDeleted(syncStateJournal: SyncStateJournal, syncStateEntry: SyncStateEntry) {
    logger.info(`Deleted entry ${syncStateEntry.uid}`);

    const storeState = store.getState();
    const syncInfoItems = storeState.cache.syncInfoItem;
    const uid = syncStateJournal.uid;
    const syncInfoJournalItems = syncInfoItems.get(uid)!;

    const syncEntry = new EteSync.SyncEntry();
    syncEntry.action = EteSync.SyncEntryAction.Delete;
    for (const entry of syncInfoJournalItems.values()) {
      const pimItem = this.syncEntryToVobject(entry);
      if (pimItem.uid === syncStateEntry.uid) {
        syncEntry.content = pimItem.toIcal();
        return { syncEntry, syncStateEntry };
      }
    }

    return null;
  }

  protected abstract async createJournal(collection: EteSync.CollectionInfo): Promise<string>;
  protected abstract async updateJournal(containerLocalId: string, collection: EteSync.CollectionInfo): Promise<void>;
  protected abstract async deleteJournal(containerLocalId: string): Promise<void>;
  protected abstract async syncPush(): Promise<void>;

  protected abstract syncEntryToVobject(syncEntry: EteSync.SyncEntry): T;
  protected abstract nativeToVobject(nativeItem: N): T;
  protected abstract nativeHashCalc(entry: N): string;

  protected abstract async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateJournalEntryData): Promise<SyncStateEntry>;
}
