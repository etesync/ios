import * as EteSync from 'etesync';
import * as Calendar from 'expo-calendar';

import { logger } from '../logging';

import { store, SyncStateJournalEntryData } from '../store';

import { NativeTask, taskVobjectToNative, taskNativeToVobject, entryNativeHashCalc } from './helpers';
import { TaskType } from '../pim-types';

import { SyncManagerCalendarBase } from './SyncManagerCalendar';
import { PushEntry } from './SyncManagerBase';

export class SyncManagerTaskList extends SyncManagerCalendarBase<TaskType, NativeTask> {
  protected collectionType = 'TASKS';
  protected entityType = Calendar.EntityTypes.REMINDER;

  protected async syncPush() {
    const storeState = store.getState();
    const syncInfoCollections = storeState.cache.syncInfoCollection;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncStateEntries = storeState.sync.stateEntries;
    const now = new Date();
    const dateYearRange = 4; // Maximum year range supported on iOS

    for (const collection of syncInfoCollections.values()) {
      const uid = collection.uid;

      if (collection.type !== this.collectionType) {
        continue;
      }

      const handled = {};
      logger.info(`Pushing ${uid}`);

      const syncStateEntriesReverse = syncStateEntries.get(uid)!.mapEntries((_entry) => {
        const entry = _entry[1];
        return [entry.localId, entry];
      }).asMutable();

      const syncEntries: PushEntry[] = [];

      const syncStateJournal = syncStateJournals.get(uid)!;
      const localId = syncStateJournal.localId;
      for (let i = -2 ; i <= 1 ; i++) {
        const remindersRangeStart = new Date(new Date().setFullYear(now.getFullYear() + (i * dateYearRange)));
        const remindersRangeEnd = new Date(new Date().setFullYear(now.getFullYear() + ((i + 1) * dateYearRange)));

        const existingReminders = await Calendar.getRemindersAsync([localId] as any, null, remindersRangeStart, remindersRangeEnd);

        existingReminders.forEach((_reminder) => {
          if (handled[_reminder.id!]) {
            return;
          }
          handled[_reminder.id!] = true;

          const syncStateEntry = syncStateEntriesReverse.get(_reminder.id!);

          const reminder = { ..._reminder, uid: (syncStateEntry) ? syncStateEntry.uid : _reminder.id! };
          const syncEntry = this.syncPushHandleAddChange(syncStateJournal, syncStateEntry, reminder);
          if (syncEntry) {
            syncEntries.push(syncEntry);
          }

          if (syncStateEntry) {
            syncStateEntriesReverse.delete(syncStateEntry.uid);
          }
        });
      }

      for (const syncStateEntry of syncStateEntriesReverse.values()) {
        // Deleted
        let existingReminder: Calendar.Reminder | undefined;
        try {
          existingReminder = await Calendar.getReminderAsync(syncStateEntry.localId);
        } catch (e) {
          // Skip
        }

        // FIXME: handle the case of the reminder still existing for some reason.
        if (!existingReminder) {
          // If the reminder still exists it means it's not deleted.
          const syncEntry = this.syncPushHandleDeleted(syncStateJournal, syncStateEntry);
          if (syncEntry) {
            syncEntries.push(syncEntry);
          }
        }
      }

      await this.pushJournalEntries(syncStateJournal, syncEntries);
    }
  }

  protected syncEntryToVobject(syncEntry: EteSync.SyncEntry) {
    return TaskType.parse(syncEntry.content);
  }

  protected nativeToVobject(nativeItem: NativeTask) {
    return taskNativeToVobject(nativeItem);
  }

  protected nativeHashCalc(task: NativeTask) {
    return entryNativeHashCalc(task);
  }

  protected async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateJournalEntryData) {
    const task = this.syncEntryToVobject(syncEntry);
    const nativeReminder = taskVobjectToNative(task);
    let syncStateEntry = syncStateEntries.get(task.uid);
    switch (syncEntry.action) {
      case EteSync.SyncEntryAction.Add:
      case EteSync.SyncEntryAction.Change: {
        let existingReminder: Calendar.Reminder | undefined;
        try {
          if (syncStateEntry) {
            existingReminder = await Calendar.getReminderAsync(syncStateEntry.localId);
          }
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
        syncStateEntry.lastHash = this.nativeHashCalc(createdReminder);

        break;
      }
      case EteSync.SyncEntryAction.Delete: {
        if (syncStateEntry) {
          // FIXME: Shouldn't have this if, it should just work
          await Calendar.deleteReminderAsync(syncStateEntry.localId);
        } else {
          syncStateEntry = {
            uid: nativeReminder.uid,
            localId: '',
            lastHash: '',
          };
        }
        break;
      }
    }

    return syncStateEntry;
  }
}
