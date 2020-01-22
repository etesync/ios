import * as EteSync from 'etesync';
import { Map as ImmutableMap } from 'immutable';

import { logger } from '../logging';

import { PimType } from '../pim-types';
import { store, persistor, CredentialsData, SyncStateJournal, SyncStateEntry, JournalsData } from '../store';
import { setSyncStateJournal, unsetSyncStateJournal, setSyncStateEntry, unsetSyncStateEntry, addEntries, setSyncStatus } from '../store/actions';
import { NativeBase, entryNativeHashCalc } from './helpers';
import { createJournalEntryFromSyncEntry } from '../etesync-helpers';
import { arrayToChunkIterator } from '../helpers';
import { BatchAction, HashDictionary } from '../EteSyncNative';

export const CHUNK_PULL = 30;
export const CHUNK_PUSH = 30;

export interface PushEntry {
  syncEntry: EteSync.SyncEntry;
  syncStateEntry: SyncStateEntry;
}

function persistSyncJournal(etesync: CredentialsData, syncStateJournal: SyncStateJournal, lastUid: string | null) {
  store.dispatch(setSyncStateJournal(etesync, { ...syncStateJournal, lastSyncUid: lastUid }));

  persistor.persist();
}

function syncUpdate(status: string | null) {
  store.dispatch(setSyncStatus(status));
  if (status) {
    logger.info(status);
  }
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
  protected abstract collectionType: string;
  public canSync: boolean;

  constructor(etesync: CredentialsData, userInfo: EteSync.UserInfo) {
    this.etesync = etesync;
    this.userInfo = userInfo;
    this.canSync = false;
  }

  public async init() {
    //
  }

  // FIXME: Remove these parameters, we should just get them inside.
  public async sync() {

    if (__DEV__) {
      // await this.clearDeviceCollections();
    }
    syncUpdate(`Starting sync (${this.collectionType})`);
    syncUpdate(`Syncing journal list (${this.collectionType})`);
    await this.syncJournalList();
    syncUpdate(`Pulling changes (${this.collectionType})`);
    await this.syncPull();
    syncUpdate(`Pushing changes (${this.collectionType})`);
    await this.syncPush();
    syncUpdate(`Finished sync (${this.collectionType})`);
  }

  public async clearDeviceCollections() {
    const storeState = store.getState();
    const etesync = this.etesync;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncInfoCollections = storeState.cache.syncInfoCollection;

    logger.info(`Clearing device collections for ${this.collectionType}`);

    for (const collection of syncInfoCollections.values()) {
      const uid = collection.uid;

      if (collection.type !== this.collectionType) {
        continue;
      }

      const journal = syncStateJournals.get(uid);

      if (journal) {
        logger.info(`Deleting ${collection.displayName}`);
        await this.deleteJournal(journal.localId);
        store.dispatch(unsetSyncStateJournal(etesync, journal));
      } else {
        logger.warn(`Skipping deletion of ${uid}. Not found.`);
      }
    }
  }

  protected async syncJournalList() {
    const etesync = this.etesync;
    const storeState = store.getState();
    const syncStateJournals = storeState.sync.stateJournals.asMutable();
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
  }

  protected async syncPull() {
    const storeState = store.getState();
    const journalsEntries = storeState.cache.entries;
    const syncInfoCollections = storeState.cache.syncInfoCollection;
    const syncInfoItems = storeState.cache.syncInfoItem;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncStateEntriesAll = storeState.sync.stateEntries;
    // FIXME: Sholud alert beforehand if local is not enable and only iCloud is and let people know, and if that the case, use iCloud if there's no local.
    // See notes for more info
    const etesync = this.etesync;

    for (const collection of syncInfoCollections.values()) {
      const uid = collection.uid;

      if (collection.type !== this.collectionType) {
        continue;
      }

      logger.info(`Pulling ${uid}`);

      const journalSyncEntries = (syncStateEntriesAll.get(uid) ?? ImmutableMap({})).asMutable();

      const syncStateJournal = syncStateJournals.get(uid)!;
      const localId = syncStateJournal.localId;

      const lastEntry = journalsEntries.get(uid)?.last(undefined);
      if (lastEntry?.uid !== syncStateJournal.lastSyncUid) {
        logger.info(`Applying changes. Current uid: ${lastEntry?.uid}, last one: ${syncStateJournal.lastSyncUid}`);
        const syncInfoJournalItems = syncInfoItems.get(uid)!;
        const entries = journalsEntries.get(uid)!.map((entry) => syncInfoJournalItems.get(entry.uid)!);
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

        let syncEntries: EteSync.SyncEntry[] = [];
        let batch: [BatchAction, N][] = [];
        const handledInBatch = new Map<string, boolean>();
        for (let i = firstEntry ; i < entries.size ; i++) {
          const syncEntry: EteSync.SyncEntry = entries.get(i)!;
          logger.debug(`Proccessing ${syncEntry.uid}`);
          try {
            const vobjectItem = this.syncEntryToVobject(syncEntry);
            const nativeItem = this.vobjectToNative(vobjectItem);
            const syncStateEntry = journalSyncEntries.get(nativeItem.uid);
            if (handledInBatch.has(nativeItem.uid)) {
              batch = batch.filter(([_action, item]) => (nativeItem.uid !== item.uid));
            } else {
              handledInBatch.set(nativeItem.uid, true);
            }
            switch (syncEntry.action) {
              case EteSync.SyncEntryAction.Add:
              case EteSync.SyncEntryAction.Change: {
                if (syncStateEntry?.localId) {
                  batch.push([BatchAction.Change, { ...nativeItem, id: syncStateEntry.localId }]);
                } else {
                  batch.push([BatchAction.Add, nativeItem]);
                }

                break;
              }
              case EteSync.SyncEntryAction.Delete: {
                if (syncStateEntry?.localId) {
                  batch.push([BatchAction.Delete, { ...nativeItem, id: syncStateEntry.localId }]);
                }

                break;
              }
            }

            syncEntries.push(syncEntry);
          } catch (e) {
            logger.warn(`Failed processing: ${syncEntry.content}`);
            throw e;
          }

          try {
            if (((i === entries.size - 1) || (i % CHUNK_PULL) === CHUNK_PULL - 1)) {
              const hashes = await this.processSyncEntries(localId, batch);

              for (const [action, nativeItem] of batch) {
                // FIXME: do this all at once
                const hash = hashes[nativeItem.uid];
                const syncStateEntry: SyncStateEntry = {
                  uid: nativeItem.uid,
                  localId: hash?.[0],
                  lastHash: hash?.[1],
                };
                switch (action) {
                  case BatchAction.Add:
                  case BatchAction.Change: {
                    journalSyncEntries.set(syncStateEntry.uid, syncStateEntry);
                    store.dispatch(setSyncStateEntry(etesync, uid, syncStateEntry));
                    break;
                  }
                  case BatchAction.Delete: {
                    if (syncStateEntry) {
                      journalSyncEntries.delete(syncStateEntry.uid);
                      store.dispatch(unsetSyncStateEntry(etesync, uid, syncStateEntry));
                    }
                    break;
                  }
                }
              }

              persistSyncJournal(etesync, syncStateJournal, syncEntry.uid!);

              syncEntries = [];
              batch = [];
              handledInBatch.clear();
            }
          } catch (e) {
            logger.warn('Failed batch saving contacts');
            throw e;
          }
        }
      }
    }
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

  protected syncPushHandleAddChange(syncStateJournal: SyncStateJournal, syncStateEntry: SyncStateEntry | undefined, nativeItem: N, itemHash: string) {
    let syncEntryAction: EteSync.SyncEntryAction | undefined;
    const currentHash = itemHash;

    if (syncStateEntry === undefined) {
      // New
      logger.info(`New entry ${nativeItem.uid}`);
      syncEntryAction = EteSync.SyncEntryAction.Add;
    } else {
      if (currentHash !== syncStateEntry.lastHash) {
        // Changed
        if (this.handleLegacyHash(syncStateJournal.uid, syncStateEntry, nativeItem, itemHash)) {
          logger.info(`Updated legacy hash for ${nativeItem.uid}`);
        } else {
          logger.info(`Changed entry ${nativeItem.uid}`);
          syncEntryAction = EteSync.SyncEntryAction.Change;
        }
      }
    }

    if (syncEntryAction) {
      const vobjectEvent = this.nativeToVobject(nativeItem);
      const syncEntry = new EteSync.SyncEntry();
      syncEntry.action = syncEntryAction;
      try {
        syncEntry.content = vobjectEvent.toIcal();
      } catch (e) {
        logger.warn(`Failed pushing update: ${JSON.stringify(nativeItem)}`);
        throw e;
      }

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
        try {
          syncEntry.content = pimItem.toIcal();
        } catch (e) {
          logger.warn(`Failed push deletion: ${entry.content}`);
          throw e;
        }
        return { syncEntry, syncStateEntry };
      }
    }

    return null;
  }

  protected handleLegacyHash(journalUid: string, syncStateEntry: SyncStateEntry | undefined, nativeItem: N, itemHash: string) {
    if (syncStateEntry?.lastHash && syncStateEntry.lastHash.indexOf(':') === -1) {
      // If the last hash was unversioned (no colon), try matching the legacy hash
      const legacyHash = entryNativeHashCalc(nativeItem);
      if (legacyHash === syncStateEntry.lastHash) {
        // If the legacy hash is the same, there's nothing to do. Just update with the new hash and continue.
        store.dispatch(setSyncStateEntry(this.etesync, journalUid, { ...syncStateEntry, lastHash: itemHash }));
        return true;
      }
    }

    return false;
  }

  protected abstract async createJournal(collection: EteSync.CollectionInfo): Promise<string>;
  protected abstract async updateJournal(containerLocalId: string, collection: EteSync.CollectionInfo): Promise<void>;
  protected abstract async deleteJournal(containerLocalId: string): Promise<void>;
  protected abstract async syncPush(): Promise<void>;

  protected abstract syncEntryToVobject(syncEntry: EteSync.SyncEntry): T;
  protected abstract vobjectToNative(vobject: T): N;
  protected abstract nativeToVobject(nativeItem: N): T;
  protected abstract async processSyncEntries(containerLocalId: string, batch: [BatchAction, N][]): Promise<HashDictionary>;
}
