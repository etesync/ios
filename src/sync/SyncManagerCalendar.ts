import * as EteSync from '../api/EteSync';
import * as ICAL from 'ical.js';
import { Calendar } from 'expo';

import { logger } from '../logging';

import { SyncInfo, SyncInfoJournal } from '../SyncGate';
import { store, SyncStateJournalEntryData } from '../store';
import { unsetSyncStateJournal } from '../store/actions';

import { eventVobjectToNative, eventNativeToVobject, entryNativeHashCalc as _entryNativeHashCalc } from './helpers';
import { colorIntToHtml } from '../helpers';
import { EventType } from '../pim-types';
import { createJournalEntryFromSyncEntry } from '../etesync-helpers';

import { SyncManager } from './SyncManager';

const ACCOUNT_NAME = 'etesync';

function entryNativeHashCalc(entry: {uid: string}) {
  return _entryNativeHashCalc(entry, ['lastModifiedDate']);
}

export class SyncManagerCalendar extends SyncManager {
  protected collectionType = 'CALENDAR';
  private localSource;

  public async init() {
    this.localSource = (await Calendar.getSourcesAsync()).find((source) => (source.name === ACCOUNT_NAME));
  }

  protected async syncPush(syncInfo: SyncInfo) {
    const syncStateJournals = this.syncStateJournals;
    const now = new Date();
    const eventsRangeStart = new Date(new Date().setFullYear(now.getFullYear() - 1));
    const eventsRangeEnd = new Date(new Date().setFullYear(now.getFullYear() + 3));

    for (const syncJournal of syncInfo.values()) {
      if (syncJournal.collection.type !== this.collectionType) {
        continue;
      }

      const collection = syncJournal.collection;
      const uid = collection.uid;
      const syncStateEntriesReverse = this.syncStateEntries.get(uid).mapEntries((_entry) => {
        const entry = _entry[1];
        return [entry.localId, entry];
      }).asMutable();

      const syncEntries: EteSync.SyncEntry[] = [];

      const syncStateJournal = syncStateJournals.get(uid);
      const localId = syncStateJournal.localId;
      const existingEvents = await Calendar.getEventsAsync([localId], eventsRangeStart, eventsRangeEnd);
      console.log(`${collection.displayName} ${existingEvents.length}`);
      existingEvents.forEach((_event) => {
        const syncStateEntry = syncStateEntriesReverse.get(_event.id);

        if (syncStateEntry === undefined) {
          // New
          const event = { ..._event, uid: _event.id };
          const vobjectEvent = eventNativeToVobject(event);
          const syncEntry = new EteSync.SyncEntry();
          logger.info(`New entry ${event.uid}`);
          syncEntry.action = EteSync.SyncEntryAction.Add;
          syncEntry.content = vobjectEvent.toIcal();
          syncEntries.push(syncEntry);
        } else {
          const event = { ..._event, uid: syncStateEntry.uid };
          const currentHash = entryNativeHashCalc(event);
          if (currentHash !== syncStateEntry.lastHash) {
            // Changed
            logger.info(`Changed entry ${event.uid}`);
            const vobjectEvent = eventNativeToVobject(event);
            const syncEntry = new EteSync.SyncEntry();
            syncEntry.action = EteSync.SyncEntryAction.Change;
            syncEntry.content = vobjectEvent.toIcal();
            syncEntries.push(syncEntry);
          }

          syncStateEntriesReverse.delete(_event.id);
        }
      });

      for (const syncStateEntry of syncStateEntriesReverse.values()) {
        // Deleted
        let existingEvent: Calendar.Event;
        try {
          existingEvent = await Calendar.getEventAsync(syncStateEntry.localId);
        } catch (e) {
          // Skip
        }

        if (!existingEvent) {
          // If the event still exists it means it's not deleted.
          logger.info(`Deleted entry ${syncStateEntry.uid}`);
          const syncEntry = new EteSync.SyncEntry();
          syncEntry.action = EteSync.SyncEntryAction.Change;
          // FIXME: need to search and get the last time it was in the journal and use that content.
          syncEntry.content = ''; // vobjectEvent.toIcal();
          syncEntries.push(syncEntry);
        }
      }

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
  }

  protected async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateJournalEntryData) {
    const event = EventType.fromVCalendar(new ICAL.Component(ICAL.parse(syncEntry.content)));
    const nativeEvent = eventVobjectToNative(event);
    let syncStateEntry = syncStateEntries.get(event.uid);
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
          const localEntryId = await Calendar.createEventAsync(containerLocalId, nativeEvent);
          syncStateEntry = {
            uid: nativeEvent.uid,
            localId: localEntryId,
            lastHash: '',
          };
        }

        const createdEvent = { ...await Calendar.getEventAsync(syncStateEntry.localId), uid: nativeEvent.uid };
        syncStateEntry.lastHash = entryNativeHashCalc(createdEvent);

        break;
      case EteSync.SyncEntryAction.Delete:
        if (syncStateEntry) {
          // FIXME: Shouldn't have this if, it should just work
          await Calendar.deleteEventAsync(syncStateEntry.localId);
        }
        break;
    }

    return syncStateEntry;
  }

  protected async createJournal(syncJournal: SyncInfoJournal): Promise<string> {
    const localSource = this.localSource;
    const collection = syncJournal.collection;

    return Calendar.createCalendarAsync({
      sourceId: localSource.id,
      entityType: Calendar.EntityTypes.EVENT,
      title: collection.displayName,
      color: colorIntToHtml(collection.color),
    });
  }

  protected async updateJournal(containerLocalId: string, syncJournal: SyncInfoJournal) {
    const localSource = this.localSource;
    const collection = syncJournal.collection;

    return Calendar.updateCalendarAsync(containerLocalId, {
      sourceId: localSource.id,
      title: collection.displayName,
      color: colorIntToHtml(collection.color),
    });
  }

  protected async deleteJournal(containerLocalId: string) {
    return Calendar.deleteCalendarAsync(containerLocalId);
  }

  protected async debugReset(syncInfo: SyncInfo) {
    const etesync = this.etesync;
    const localSource = this.localSource;
    const syncStateJournals = this.syncStateJournals.asMutable();
    const syncStateEntries = this.syncStateEntries.asMutable();

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    for (const calendar of calendars) {
      if (calendar.source.id === localSource.id) {
        logger.info(`Deleting ${calendar.title}`);
        await Calendar.deleteCalendarAsync(calendar.id);
      }
    }

    syncStateJournals.forEach((journal) => {
      store.dispatch(unsetSyncStateJournal(etesync, journal));
      syncStateJournals.delete(journal.uid);

      // Deletion from the store happens automatically
      syncStateEntries.delete(journal.uid);

      return true;
    });

    this.syncStateJournals = syncStateJournals.asImmutable();
    this.syncStateEntries = syncStateEntries.asImmutable();
  }
}

