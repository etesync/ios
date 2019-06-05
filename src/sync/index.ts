import * as EteSync from '../api/EteSync';
import { Calendar } from 'expo';

import { SyncInfo } from '../SyncGate';
import { store, CredentialsData, SyncStateJournalData, SyncStateEntryData } from '../store';
import { setSyncStateJournal, unsetSyncStateJournal } from '../store/actions';

import { colorIntToHtml } from '../helpers';

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
export class SyncManager {
  constructor() {
    //
  }

  public async sync(etesync: CredentialsData, syncInfo: SyncInfo, syncStateJournals: SyncStateJournalData, syncStateEntries: SyncStateEntryData) {
    // FIXME: Sholud alert beforehand if local is not enable and only iCloud is and let people know, and if that the case, use iCloud if there's no local.
    // See notes for more info
    const localSource = (await Calendar.getSourcesAsync()).find((source) => (source.type === (Calendar as any).SourceType.LOCAL));

    const existingJournals = syncStateJournals.toJS();
    syncInfo.forEach(async (syncJournal) => {
      if (syncJournal.collection.type !== 'CALENDAR') {
        // FIXME: We only do Calendars atm
        return;
      }

      const collection = syncJournal.collection;
      const uid = collection.uid;

      let syncStateJournal = syncStateJournals.get(uid);
      let localId: string;
      if (uid in existingJournals) {
        // FIXME: only modify if changed!
        localId = existingJournals[uid].localId;
        await Calendar.updateCalendarAsync(localId, {
          sourceId: localSource.id,
          title: collection.displayName,
          color: colorIntToHtml(collection.color),
        });

        delete existingJournals[uid];
      } else {
        localId = await Calendar.createCalendarAsync({
          sourceId: localSource.id,
          entityType: Calendar.EntityTypes.EVENT,
          title: collection.displayName,
          color: colorIntToHtml(collection.color),
        });

        syncStateJournal = {
          localId,
          uid,
          lastSyncUid: null,
        };
        store.dispatch(setSyncStateJournal(etesync, syncStateJournal));
      }

      const entries = syncJournal.entries;
      const lastEntry: EteSync.SyncEntry = entries.last();
      if (lastEntry && (lastEntry.uid !== syncStateJournal.lastSyncUid)) {
        console.log('Apply changes from entries');
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
          switch (syncEntry.action) {
            case EteSync.SyncEntryAction.Add:
              break;
            case EteSync.SyncEntryAction.Change:
              break;
            case EteSync.SyncEntryAction.Delete:
              break;
          }
        }
        // FIXME: probably do in chunks
        syncStateJournal.lastSyncUid = lastEntry.uid;
        // store.dispatch(setSyncStateJournal(etesync, syncStateJournal));
      }

      // FIXME: Push local
    });

    // Remove deleted calendars
    Object.values(existingJournals).forEach(async (oldJournal) => {
      await Calendar.deleteCalendarAsync(oldJournal.localId);
      store.dispatch(unsetSyncStateJournal(etesync, oldJournal));
    });
  }
}
