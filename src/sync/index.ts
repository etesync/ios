import * as EteSync from '../api/EteSync';
import * as ICAL from 'ical.js';
import { Calendar } from 'expo';

import { SyncInfo } from '../SyncGate';
import { store, CredentialsData, SyncStateJournalData, SyncStateEntryData } from '../store';
import { setSyncStateJournal, unsetSyncStateJournal, setSyncStateEntry, unsetSyncStateEntry } from '../store/actions';

import { eventVobjectToNative } from './helpers';
import { colorIntToHtml } from '../helpers';
import { EventType } from '../pim-types';

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

  public async sync(etesync: CredentialsData, syncInfo: SyncInfo, _syncStateJournals: SyncStateJournalData, _syncStateEntries: SyncStateEntryData) {
    // FIXME: Sholud alert beforehand if local is not enable and only iCloud is and let people know, and if that the case, use iCloud if there's no local.
    // See notes for more info
    const localSource = (await Calendar.getSourcesAsync()).find((source) => (source.type === (Calendar as any).SourceType.LOCAL));
    const syncStateJournals = _syncStateJournals.toJS();
    const syncStateEntries = _syncStateEntries.toJS();

    if (false) { // Reset
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      for (const calendar of calendars) {
        if (calendar.source.id === localSource.id) {
          console.log(`Deleting ${calendar.title}`);
          await Calendar.deleteCalendarAsync(calendar.id);
        }
      }

      Object.values(syncStateJournals).forEach((journal) => {
        store.dispatch(unsetSyncStateJournal(etesync, journal));
        delete syncStateJournals[journal.uid];
      });

      Object.values(syncStateEntries).forEach((entry) => {
        store.dispatch(unsetSyncStateEntry(etesync, entry));
        delete syncStateEntries[entry.uid];
      });
    }

    for (const syncJournal of syncInfo.values()) {
      if (syncJournal.collection.type !== 'CALENDAR') {
        // FIXME: We only do Calendars atm
        continue;
      }

      const collection = syncJournal.collection;
      const uid = collection.uid;

      let syncStateJournal = syncStateJournals[uid];
      let localId: string;
      if (uid in syncStateJournals) {
        // FIXME: only modify if changed!
        console.log(`Updating ${uid}`);
        localId = syncStateJournals[uid].localId;
        await Calendar.updateCalendarAsync(localId, {
          sourceId: localSource.id,
          title: collection.displayName,
          color: colorIntToHtml(collection.color),
        });

        delete syncStateJournals[uid];
      } else {
        console.log(`Creating ${uid}`);
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
          const event = EventType.fromVCalendar(new ICAL.Component(ICAL.parse(syncEntry.content)));
          const nativeEvent = eventVobjectToNative(event);
          let syncStateEntry = syncStateEntries[event.uid];
          switch (syncEntry.action) {
            case EteSync.SyncEntryAction.Add:
            case EteSync.SyncEntryAction.Change:
              let existingEvent: Calendar.Event;
              try {
                existingEvent = await Calendar.getEventAsync(syncStateEntry.localId);
              } catch (e) {
                // Skip
              }
              if (syncStateEntry && existingEvent) {
                await Calendar.updateEventAsync(syncStateEntry.localId, nativeEvent);
              } else {
                const localEntryId = await Calendar.createEventAsync(localId, nativeEvent);
                syncStateEntry = {
                  uid: nativeEvent.uid,
                  localId: localEntryId,
                };
              }
              syncStateEntries[syncStateEntry.uid] = syncStateEntry;
              store.dispatch(setSyncStateEntry(etesync, syncStateEntry));
              break;
            case EteSync.SyncEntryAction.Delete:
              if (syncStateEntry) {
                // FIXME: Shouldn't have this if, it should just work
                await Calendar.deleteEventAsync(syncStateEntry.localId);
                delete syncStateEntries[syncStateEntry.localId];
                store.dispatch(unsetSyncStateEntry(etesync, syncStateEntry));
              }
              break;
          }
        }
        // FIXME: probably do in chunks
        syncStateJournal.lastSyncUid = lastEntry.uid;
        store.dispatch(setSyncStateJournal(etesync, syncStateJournal));
      }

      // FIXME: Push local
    }

    // Remove deleted calendars
    for (const oldJournal of Object.values(syncStateJournals)) {
      console.log(`Deleting ${oldJournal.uid}`);
      await Calendar.deleteCalendarAsync(oldJournal.localId);
      store.dispatch(unsetSyncStateJournal(etesync, oldJournal));
    }

    console.log('Finished');
  }
}
