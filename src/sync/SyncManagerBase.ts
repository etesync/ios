// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as Etebase from "etebase";
import { Map as ImmutableMap } from "immutable";

import { logger } from "../logging";

import { PimType } from "../pim-types";
import { store, persistor, CredentialsData, SyncStateJournal, SyncStateEntry, asyncDispatch } from "../store";
import { setSyncStateJournal, unsetSyncStateJournal, setSyncStateEntry, unsetSyncStateEntry, setSyncStatus, addNonFatalError, setCacheItemMulti, setSyncCollection, itemBatch } from "../store/actions";
import { NativeBase, entryNativeHashCalc } from "./helpers";
import { arrayToChunkIterator } from "../helpers";
import { BatchAction, HashDictionary } from "../EteSyncNative";

export const CHUNK_PULL = 30;
export const CHUNK_PUSH = 30;

export interface PushEntry {
  item: Etebase.Item;
  syncStateEntry: SyncStateEntry;
}

function persistSyncJournal(etesync: CredentialsData | Etebase.Account, syncStateJournal: SyncStateJournal, lastUid: string | null) {
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
  protected etebase: Etebase.Account;
  protected abstract collectionType: string;
  public canSync: boolean;

  constructor(etebase: Etebase.Account) {
    this.etebase = etebase;
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
    const etebase = this.etebase;
    const syncStateJournals = storeState.sync.stateJournals;
    const decryptedCollections = storeState.cache2.decryptedCollections;

    logger.info(`Clearing device collections for ${this.collectionType}`);

    for (const [uid, { meta }] of decryptedCollections.entries()) {
      if (meta.type !== this.collectionType) {
        continue;
      }

      const journal = syncStateJournals.get(uid);

      if (journal) {
        logger.info(`Deleting ${meta.name}`);
        await this.deleteJournal(journal.localId);
        store.dispatch(unsetSyncStateJournal(etebase, journal));
      } else {
        logger.warn(`Skipping deletion of ${uid}. Not found.`);
      }
    }
  }

  protected async syncJournalList() {
    const etebase = this.etebase;
    const storeState = store.getState();
    const syncStateJournals = storeState.sync.stateJournals.asMutable();
    const decryptedCollections = storeState.cache2.decryptedCollections;
    const currentJournals = [] as SyncStateJournal[];
    const notOurs = new Map<string, boolean>();

    for (const [uid, { meta }] of decryptedCollections.entries()) {
      if (meta.type !== this.collectionType) {
        notOurs.set(uid, true);
        continue;
      }

      let syncStateJournal = syncStateJournals.get(uid)!;
      let localId: string;
      if (syncStateJournals.has(uid)) {
        // FIXME: only modify if changed!
        logger.info(`Updating ${uid}`);
        localId = syncStateJournal.localId;
        await this.updateJournal(localId, meta);
        syncStateJournals.delete(uid);
      } else {
        logger.info(`Creating ${uid}`);
        localId = await this.createJournal(meta);

        syncStateJournal = {
          localId,
          uid,
          lastSyncUid: null,
        };
        store.dispatch(setSyncStateJournal(etebase, syncStateJournal));
      }

      currentJournals.push(syncStateJournal);
    }

    // Remove deleted calendars
    await Promise.all(syncStateJournals.map(async (oldJournal) => {
      if (!notOurs.has(oldJournal.uid)) {
        logger.info(`Deleting ${oldJournal.uid}`);
        await this.deleteJournal(oldJournal.localId);
        syncStateJournals.delete(oldJournal.uid);
        store.dispatch(unsetSyncStateJournal(etebase, oldJournal));
      }
      return true;
    }));
  }

  private async pullHandleItems(syncStateJournal: SyncStateJournal, col: Etebase.Collection, itemMgr: Etebase.ItemManager, items: Etebase.Item[]) {
    const storeState = store.getState();
    const syncStateEntriesAll = storeState.sync.stateEntries;
    const journalSyncEntries = (syncStateEntriesAll.get(col.uid) ?? ImmutableMap({})).asMutable();
    const batch: [BatchAction, N][] = [];
    for (const item of items) {
      logger.debug(`Proccessing ${item.uid}`);
      const content = await item.getContent(Etebase.OutputFormat.String);
      try {
        const vobjectItem = this.contentToVobject(content);
        const nativeItem = this.vobjectToNative(vobjectItem);
        const syncStateEntry = journalSyncEntries.get(nativeItem.uid);
        if (item.isDeleted) {
          if (syncStateEntry?.localId) {
            batch.push([BatchAction.Delete, { ...nativeItem, id: syncStateEntry.localId }]);
          }
        } else {
          if (syncStateEntry?.localId) {
            batch.push([BatchAction.Change, { ...nativeItem, id: syncStateEntry.localId }]);
          } else {
            batch.push([BatchAction.Add, nativeItem]);
          }
        }
      } catch (e) {
        logger.warn(`Failed processing: ${content}`);
        store.dispatch(addNonFatalError(e));
      }
    }

    const localId = syncStateJournal.localId;

    if (batch.length > 0) {
      try {
        const hashes = await this.processSyncEntries(localId, batch);

        for (const [action, nativeItem] of batch) {
          // FIXME: do this all at once
          const hash = hashes[nativeItem.uid];
          const error = hash?.[2];
          if (error) {
            store.dispatch(addNonFatalError(new Error(`${error}. Skipped ${nativeItem.uid}\nThis error means this item failed to sync properly. Either to get updated, or deleted.`)));
          }
          const syncStateEntry: SyncStateEntry = {
            uid: nativeItem.uid,
            localId: hash?.[0],
            lastHash: hash?.[1],
          };

          if (!error && ((action === BatchAction.Add) || (action === BatchAction.Change))) {
            journalSyncEntries.set(syncStateEntry.uid, syncStateEntry);
            store.dispatch(setSyncStateEntry(this.etebase, col.uid, syncStateEntry));
          } else {
            // We want to delete our entries if there's an error (or if the action is delete anyway)
            if (syncStateEntry) {
              journalSyncEntries.delete(syncStateEntry.uid);
              store.dispatch(unsetSyncStateEntry(this.etebase, col.uid, syncStateEntry));
            }
          }
        }

        persistSyncJournal(this.etebase, syncStateJournal, col.stoken);
        store.dispatch(setCacheItemMulti(col.uid, itemMgr, items));
      } catch (e) {
        logger.warn("Failed batch saving");
        throw e;
      }
    }
  }

  private async pullCollection(syncStateJournal: SyncStateJournal, col: Etebase.Collection) {
    const storeState = store.getState();
    const syncCollection = storeState.sync2.collections.get(col.uid, undefined);
    const etebase = this.etebase;

    const colMgr = etebase.getCollectionManager();
    const itemMgr = colMgr.getItemManager(col);

    let stoken = syncCollection?.stoken;
    const limit = CHUNK_PULL;
    let done = false;
    while (!done) {
      const items = await itemMgr.list({ stoken, limit });
      await this.pullHandleItems(syncStateJournal, col, itemMgr, items.data);
      done = items.done;
      stoken = items.stoken;
    }

    if (syncCollection?.stoken !== stoken) {
      store.dispatch(setSyncCollection(col.uid, stoken!));
    }
  }

  protected async syncPull() {
    const storeState = store.getState();
    const decryptedCollections = storeState.cache2.decryptedCollections;
    const cacheCollections = storeState.cache2.collections;
    const syncStateJournals = storeState.sync.stateJournals;
    // FIXME: Sholud alert beforehand if local is not enable and only iCloud is and let people know, and if that the case, use iCloud if there's no local.
    // See notes for more info
    const etebase = this.etebase;
    const colMgr = etebase.getCollectionManager();

    for (const [uid, { meta }] of decryptedCollections.entries()) {
      if (meta.type !== this.collectionType) {
        continue;
      }

      logger.info(`Pulling ${uid}`);

      const col = colMgr.cacheLoad(cacheCollections.get(uid)!);
      const syncStateJournal = syncStateJournals.get(uid)!;
      if (col.stoken !== syncStateJournal.lastSyncUid) {
        logger.info(`Applying changes. Current stoken: ${col.stoken}, last one: ${syncStateJournal.lastSyncUid}`);
        await this.pullCollection(syncStateJournal, col);
      }
    }
  }

  protected async pushJournalEntries(pSyncStateJournal: SyncStateJournal, pushEntries: PushEntry[]) {
    if (pushEntries.length > 0) {
      const storeState = store.getState();
      const cacheCollections = storeState.cache2.collections;
      const etebase = this.etebase;
      const colMgr = etebase.getCollectionManager();
      const col = colMgr.cacheLoad(cacheCollections.get(pSyncStateJournal.uid)!);
      const itemMgr = colMgr.getItemManager(col);

      for (const pushChunk of arrayToChunkIterator(pushEntries, CHUNK_PUSH)) {
        const items = pushChunk.map((x) => x.item);
        await asyncDispatch(itemBatch(col, itemMgr, items));
      }
    }
  }

  protected async syncPushHandleAddChange(syncStateJournal: SyncStateJournal, syncStateEntry: SyncStateEntry | undefined, nativeItem: N, itemHash: string): Promise<PushEntry | null> {
    let changed = false;
    const currentHash = itemHash;

    if (syncStateEntry === undefined) {
      // New
      logger.info(`New entry ${nativeItem.uid}`);
      changed = true;
    } else {
      if (currentHash !== syncStateEntry.lastHash) {
        // Changed
        if (this.handleLegacyHash(syncStateJournal.uid, syncStateEntry, nativeItem, itemHash)) {
          logger.info(`Updated legacy hash for ${nativeItem.uid}`);
        } else {
          logger.info(`Changed entry ${nativeItem.uid}`);
          changed = true;
        }
      }
    }

    if (changed) {
      const storeState = store.getState();
      const cacheCollections = storeState.cache2.collections;
      const etebase = this.etebase;
      const colMgr = etebase.getCollectionManager();
      const col = colMgr.cacheLoad(cacheCollections.get(syncStateJournal.uid)!);
      const cacheItems = storeState.cache2.items.get(col.uid)!;
      const itemMgr = colMgr.getItemManager(col);

      const vobjectEvent = this.nativeToVobject(nativeItem);

      let content;
      try {
        content = vobjectEvent.toIcal();
      } catch (e) {
        logger.warn(`Failed pushing update: ${JSON.stringify(nativeItem)}`);
        throw e;
      }

      const mtime = (new Date()).getTime();

      let item: Etebase.Item | undefined;
      if (syncStateEntry) {
        // Existing item
        const decryptedItems = storeState.cache2.decryptedItems.get(col.uid)!;

        for (const [itemUid, { meta }] of decryptedItems.entries()) {
          if (meta.name === syncStateEntry.uid) {
            item = itemMgr.cacheLoad(cacheItems.get(itemUid)!);
            break;
          }
        }

        if (!item) {
          throw new Error("Failed getting decrypted item");
        }

        await item.setContent(content);
        const meta = await item.getMeta();
        meta.mtime = mtime;
        await item.setMeta(meta);
      } else {
        // New
        const meta: Etebase.ItemMetadata = {
          mtime,
          name: nativeItem.uid,
        };
        item = await itemMgr.create(meta, content);
      }

      syncStateEntry = {
        uid: nativeItem.uid,
        localId: nativeItem.id!,
        lastHash: currentHash,
      };

      return { item, syncStateEntry };
    }

    return null;
  }

  protected async syncPushHandleDeleted(syncStateJournal: SyncStateJournal, syncStateEntry: SyncStateEntry): Promise<PushEntry | null> {
    logger.info(`Deleted entry ${syncStateEntry.uid}`);
    const storeState = store.getState();
    const cacheCollections = storeState.cache2.collections;
    const etebase = this.etebase;
    const colMgr = etebase.getCollectionManager();
    const col = colMgr.cacheLoad(cacheCollections.get(syncStateJournal.uid)!);
    const cacheItems = storeState.cache2.items.get(col.uid)!;
    const decryptedItems = storeState.cache2.decryptedItems.get(col.uid)!;
    const itemMgr = colMgr.getItemManager(col);

    for (const [itemUid, { meta }] of decryptedItems.entries()) {
      if (meta.name === syncStateEntry.uid) {
        const item = itemMgr.cacheLoad(cacheItems.get(itemUid)!);
        return { item, syncStateEntry };
      }
    }

    return null;
  }

  protected handleLegacyHash(journalUid: string, syncStateEntry: SyncStateEntry | undefined, nativeItem: N, itemHash: string) {
    if (syncStateEntry?.lastHash && syncStateEntry.lastHash.indexOf(":") === -1) {
      // If the last hash was unversioned (no colon), try matching the legacy hash
      const legacyHash = entryNativeHashCalc(nativeItem);
      if (legacyHash === syncStateEntry.lastHash) {
        // If the legacy hash is the same, there's nothing to do. Just update with the new hash and continue.
        store.dispatch(setSyncStateEntry(this.etebase, journalUid, { ...syncStateEntry, lastHash: itemHash }));
        return true;
      }
    }

    return false;
  }

  protected abstract async createJournal(collection: Etebase.CollectionMetadata): Promise<string>;
  protected abstract async updateJournal(containerLocalId: string, collection: Etebase.CollectionMetadata): Promise<void>;
  protected abstract async deleteJournal(containerLocalId: string): Promise<void>;
  protected abstract async syncPush(): Promise<void>;

  protected abstract contentToVobject(content: string): T;
  protected abstract vobjectToNative(vobject: T): N;
  protected abstract nativeToVobject(nativeItem: N): T;
  protected abstract async processSyncEntries(containerLocalId: string, batch: [BatchAction, N][]): Promise<HashDictionary>;
}
