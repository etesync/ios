import * as EteSync from '../api/EteSync';
import * as ICAL from 'ical.js';
import * as Calendar from 'expo-calendar';

import { SyncInfo } from '../SyncGate';
import { SyncStateJournalEntryData } from '../store';

import { taskVobjectToNative, entryNativeHashCalc as _entryNativeHashCalc } from './helpers';
import { PimType, TaskType } from '../pim-types';

import { SyncManagerCalendarBase } from './SyncManagerCalendar';

function entryNativeHashCalc(entry: {uid: string}) {
  return _entryNativeHashCalc(entry, ['lastModifiedDate']);
}

export class SyncManagerTaskList extends SyncManagerCalendarBase {
  protected collectionType = 'TASKS';
  protected entityType = Calendar.EntityTypes.REMINDER;

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
}
