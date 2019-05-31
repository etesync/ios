import * as EteSync from '../api/EteSync';
import { Calendar } from 'expo';

import { SyncInfo } from '../SyncGate';
import { store, CredentialsData, SyncStateJournalData, SyncStateEntryData } from '../store';
import { setSyncStateJournal, unsetSyncStateJournal } from '../store/actions';

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
      const lastEntry: EteSync.SyncEntry = syncJournal.entries.last();

      if (uid in existingJournals) {
        // FIXME: only modify if changed!
        const localId = existingJournals[uid].localId;
        await Calendar.updateCalendarAsync(localId, {
          sourceId: localSource.id,
          title: collection.displayName,
          color: 'red', // FIXME collection.color,
        });

        delete existingJournals[uid];
      } else {
        const localId = await Calendar.createCalendarAsync({
          sourceId: localSource.id,
          entityType: Calendar.EntityTypes.EVENT,
          title: collection.displayName,
          color: 'red', // FIXME collection.color,
        });

        syncStateJournal = {
          localId,
          uid,
          lastSyncUid: null,
        };
        store.dispatch(setSyncStateJournal(etesync, syncStateJournal));
      }

      if (lastEntry.uid !== syncStateJournal.lastSyncUid) {
        console.log('Apply changes from entries');
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
