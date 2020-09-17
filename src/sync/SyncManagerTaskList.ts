// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as Calendar from "expo-calendar";

import { calculateHashesForReminders, BatchAction, HashDictionary, processRemindersChanges } from "../EteSyncNative";

import { logger } from "../logging";

import { store } from "../store";

import { NativeTask, taskVobjectToNative, taskNativeToVobject } from "./helpers";
import { TaskType } from "../pim-types";

import { SyncManagerCalendarBase } from "./SyncManagerCalendar";
import { PushEntry } from "./SyncManagerBase";

export class SyncManagerTaskList extends SyncManagerCalendarBase<TaskType, NativeTask> {
  protected permissionsType = "TASKS";
  protected collectionType = "etebase.vtodo";
  protected collectionTypeDisplay = "Tasks";
  protected entityType = Calendar.EntityTypes.REMINDER;

  protected async syncPush() {
    const storeState = store.getState();
    const decryptedCollections = storeState.cache2.decryptedCollections;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncStateEntries = storeState.sync.stateEntries;

    for (const [uid, { meta }] of decryptedCollections.entries()) {
      if (meta.type !== this.collectionType) {
        continue;
      }

      logger.info(`Pushing ${uid}`);

      const syncStateEntriesReverse = syncStateEntries.get(uid)!.mapEntries((_entry) => {
        const entry = _entry[1];
        return [entry.localId, entry];
      }).asMutable();

      const syncEntries: PushEntry[] = [];

      const syncStateJournal = syncStateJournals.get(uid)!;
      const localId = syncStateJournal.localId;
      const existingReminders = await calculateHashesForReminders(localId);
      for (const [reminderId, reminderHash] of existingReminders) {
        const syncStateEntry = syncStateEntriesReverse.get(reminderId!);

        if (syncStateEntry?.lastHash !== reminderHash) {
          const _reminder = await Calendar.getReminderAsync(reminderId);
          const reminder = { ..._reminder, uid: (syncStateEntry) ? syncStateEntry.uid : _reminder.id! };
          const syncEntry = await this.syncPushHandleAddChange(syncStateJournal, syncStateEntry, reminder, reminderHash);
          if (syncEntry) {
            syncEntries.push(syncEntry);
          }
        }

        if (syncStateEntry) {
          syncStateEntriesReverse.delete(syncStateEntry.uid);
        }
      }

      for (const syncStateEntry of syncStateEntriesReverse.values()) {
        // Deleted
        let existingReminder: Calendar.Reminder | undefined;
        try {
          existingReminder = await Calendar.getReminderAsync(syncStateEntry.localId);
        } catch (e) {
          // Skip
        }

        let shouldDelete = !existingReminder;
        if (existingReminder) {
          // FIXME: handle the case of the event still existing and on the same calendar. Probably means we are just not in the range.
          if (existingReminder.calendarId !== localId) {
            shouldDelete = true;
          }
        }

        if (shouldDelete) {
          // If the reminder still exists it means it's not deleted.
          const syncEntry = await this.syncPushHandleDeleted(syncStateJournal, syncStateEntry);
          if (syncEntry) {
            syncEntries.push(syncEntry);
          }
        }
      }

      await this.pushJournalEntries(syncStateJournal, syncEntries);
    }
  }

  protected contentToVobject(content: string) {
    return TaskType.parse(content);
  }

  protected vobjectToNative(vobject: TaskType) {
    return taskVobjectToNative(vobject);
  }

  protected nativeToVobject(nativeItem: NativeTask) {
    return taskNativeToVobject(nativeItem);
  }

  protected processSyncEntries(containerLocalId: string, batch: [BatchAction, NativeTask][]): Promise<HashDictionary> {
    return processRemindersChanges(containerLocalId, batch);
  }
}
