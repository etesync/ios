import * as EteSync from '../api/EteSync';

import { SyncInfo, SyncInfoJournal } from '../SyncGate';
import { store, CredentialsData, SyncStateJournalData, SyncStateEntryData, SyncStateJournal } from '../store';
import { setSyncStateJournal, unsetSyncStateJournal, setSyncStateEntry, unsetSyncStateEntry } from '../store/actions';

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
export abstract class SyncManager {
  protected etesync;
  protected userInfo;
  protected collectionType: string;
  protected syncStateJournals;
  protected syncStateEntries;

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
      // await this.debugReset(syncInfo);
    }
    console.log('Starting Sync');
    console.log('Syncing journal list');
    await this.syncJournalList(syncInfo);
    console.log('Pulling changes');
    await this.syncPull(syncInfo);
    console.log('Pushing changes');
    await this.syncPush(syncInfo);
    console.log('Finished Sync');
  }

  protected async syncJournalList(syncInfo: SyncInfo) {
    const etesync = this.etesync;
    const syncStateJournals = this.syncStateJournals.asMutable();
    const currentJournals = [] as SyncStateJournal[];

    for (const syncJournal of syncInfo.values()) {
      if (syncJournal.collection.type !== this.collectionType) {
        continue;
      }

      const collection = syncJournal.collection;
      const uid = collection.uid;

      let syncStateJournal = syncStateJournals.get(uid);
      let localId: string;
      if (syncStateJournals.has(uid)) {
        // FIXME: only modify if changed!
        console.log(`Updating ${uid}`);
        localId = syncStateJournals.get(uid).localId;
        await this.updateJournal(localId, syncJournal);
        syncStateJournals.delete(uid);
      } else {
        console.log(`Creating ${uid}`);
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
      console.log(`Deleting ${oldJournal.uid}`);
      await this.deleteJournal(oldJournal.localId);
      syncStateJournals.delete(oldJournal.uid);
      store.dispatch(unsetSyncStateJournal(etesync, oldJournal));
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
    const syncStateEntries = this.syncStateEntries.asMutable();

    for (const syncJournal of syncInfo.values()) {
      if (syncJournal.collection.type !== this.collectionType) {
        continue;
      }

      const collection = syncJournal.collection;
      const uid = collection.uid;

      const syncStateJournal = syncStateJournals.get(uid);
      const localId = syncStateJournals.get(uid).localId;

      const entries = syncJournal.entries;
      const lastEntry: EteSync.SyncEntry = entries.last();
      if (lastEntry && (lastEntry.uid !== syncStateJournal.lastSyncUid)) {
        console.log(`Applying changes. Current uid: ${lastEntry.uid}, last one: ${syncStateJournal.lastSyncUid}`);
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

        // FIXME: optimise by first compressing redundant changes here and only then applynig to iOS
        for (let i = firstEntry ; i < entries.size ; i++) {
          const syncEntry: EteSync.SyncEntry = entries.get(i);
          const syncStateEntry = await this.processSyncEntry(localId, syncEntry, syncStateEntries);
          switch (syncEntry.action) {
            case EteSync.SyncEntryAction.Add:
            case EteSync.SyncEntryAction.Change:
              syncStateEntries.set(syncStateEntry.uid, syncStateEntry);
              store.dispatch(setSyncStateEntry(etesync, syncStateEntry));
              break;
            case EteSync.SyncEntryAction.Delete:
              if (syncStateEntry) {
                syncStateEntries.delete(syncStateEntry.localId);
                store.dispatch(unsetSyncStateEntry(etesync, syncStateEntry));
              }
              break;
          }
        }
        // FIXME: probably do in chunks
        syncStateJournal.lastSyncUid = lastEntry.uid;
        store.dispatch(setSyncStateJournal(etesync, syncStateJournal));
      }
    }

    this.syncStateEntries = syncStateEntries.asImmutable();
  }

  protected abstract async createJournal(syncJournal: SyncInfoJournal): Promise<string>;
  protected abstract async updateJournal(containerLocalId: string, syncJournal: SyncInfoJournal);
  protected abstract async deleteJournal(containerLocalId: string);
  protected abstract async syncPush(syncInfo: SyncInfo);

  protected abstract async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateEntryData);

  protected abstract async debugReset(syncInfo: SyncInfo);
}

