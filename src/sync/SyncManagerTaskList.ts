import * as EteSync from '../api/EteSync';
import * as ICAL from 'ical.js';
import * as Calendar from 'expo-calendar';

import { SyncInfo } from '../SyncGate';
import { SyncStateJournalEntryData } from '../store';

import { NativeTask, taskVobjectToNative, taskNativeToVobject, entryNativeHashCalc } from './helpers';
import { TaskType } from '../pim-types';

import { SyncManagerCalendarBase } from './SyncManagerCalendar';

export class SyncManagerTaskList extends SyncManagerCalendarBase<TaskType, NativeTask> {
  protected collectionType = 'TASKS';
  protected entityType = Calendar.EntityTypes.REMINDER;

  protected async syncPush(syncInfo: SyncInfo) {
    // FIXME: implement
  }

  protected syncEntryToVobject(syncEntry: EteSync.SyncEntry) {
    return TaskType.fromVCalendar(new ICAL.Component(ICAL.parse(syncEntry.content)));
  }

  protected nativeToVobject(nativeItem: NativeTask) {
    return taskNativeToVobject(nativeItem);
  }

  protected async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateJournalEntryData) {
    const task = this.syncEntryToVobject(syncEntry);
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
