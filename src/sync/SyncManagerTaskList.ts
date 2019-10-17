import * as EteSync from '../api/EteSync';
import * as ICAL from 'ical.js';
import * as Calendar from 'expo-calendar';

import { logger } from '../logging';

import { SyncInfo, SyncInfoJournal } from '../SyncGate';
import { store, SyncStateJournalEntryData } from '../store';
import { unsetSyncStateJournal } from '../store/actions';

import { taskVobjectToNative, entryNativeHashCalc as _entryNativeHashCalc } from './helpers';
import { colorIntToHtml } from '../helpers';
import { PimType, TaskType } from '../pim-types';

import { SyncManagerBase } from './SyncManagerBase';

const ACCOUNT_NAME = 'etesync';

function entryNativeHashCalc(entry: {uid: string}) {
  return _entryNativeHashCalc(entry, ['lastModifiedDate']);
}

export class SyncManagerTaskList extends SyncManagerBase {
  protected collectionType = 'TASKS';
  private localSource: Calendar.Source;

  public async init() {
    this.localSource = (await Calendar.getSourcesAsync()).find((source) => (source.name === ACCOUNT_NAME));
  }

  protected async syncPush(syncInfo: SyncInfo) {
    // FIXME: implement
  }

  protected pimItemFromSyncEntry(syncEntry: EteSync.SyncEntry): PimType {
    return TaskType.fromVCalendar(new ICAL.Component(ICAL.parse(syncEntry.content)));
  }

  protected async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateJournalEntryData) {
    const task = this.pimItemFromSyncEntry(syncEntry) as TaskType;
    const nativeReminder = taskVobjectToNative(task);
    let syncStateEntry = syncStateEntries.get(task.uid);
    switch (syncEntry.action) {
      case EteSync.SyncEntryAction.Add:
      case EteSync.SyncEntryAction.Change:
        let existingReminder: Calendar.Reminder;
        try {
          existingReminder = await Calendar.getReminderAsync(syncStateEntry.localId);
        } catch (e) {
          // Skip
        }
        if (syncStateEntry && existingReminder) {
          await Calendar.updateReminderAsync(syncStateEntry.localId, nativeReminder);
        } else {
          const localEntryId = await Calendar.createReminderAsync(containerLocalId, nativeReminder);
          syncStateEntry = {
            uid: nativeReminder.uid,
            localId: localEntryId,
            lastHash: '',
          };
        }

        const createdReminder = { ...await Calendar.getReminderAsync(syncStateEntry.localId), uid: nativeReminder.uid };
        syncStateEntry.lastHash = entryNativeHashCalc(createdReminder);

        break;
      case EteSync.SyncEntryAction.Delete:
        if (syncStateEntry) {
          // FIXME: Shouldn't have this if, it should just work
          await Calendar.deleteReminderAsync(syncStateEntry.localId);
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
      entityType: Calendar.EntityTypes.REMINDER,
      title: collection.displayName,
      color: colorIntToHtml(collection.color),
    });
  }

  protected async updateJournal(containerLocalId: string, syncJournal: SyncInfoJournal) {
    const localSource = this.localSource;
    const collection = syncJournal.collection;

    Calendar.updateCalendarAsync(containerLocalId, {
      sourceId: localSource.id,
      title: collection.displayName,
      color: colorIntToHtml(collection.color),
    });
  }

  protected async deleteJournal(containerLocalId: string) {
    return Calendar.deleteCalendarAsync(containerLocalId);
  }

  protected async clearDeviceCollections(syncInfo: SyncInfo) {
    const etesync = this.etesync;
    const localSource = this.localSource;
    const syncStateJournals = this.syncStateJournals.asMutable();
    const syncStateEntries = this.syncStateEntries.asMutable();

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
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


