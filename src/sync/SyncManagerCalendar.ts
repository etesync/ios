// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as Etebase from "etebase";
import * as Calendar from "expo-calendar";

import { calculateHashesForEvents, processEventsChanges, BatchAction, HashDictionary } from "../EteSyncNative";

import { logger } from "../logging";

import { store } from "../store";

import { eventVobjectToNative, eventNativeToVobject, NativeBase, NativeEvent } from "./helpers";
import { defaultColor } from "../helpers";
import { PimType, EventType } from "../pim-types";

import { SyncManagerBase, PushEntry } from "./SyncManagerBase";

const ACCOUNT_NAME = "etesync";

export abstract class SyncManagerCalendarBase<T extends PimType, N extends NativeBase> extends SyncManagerBase<T, N> {
  protected abstract entityType: string;

  protected localSource: Calendar.Source;

  public async init() {
    await super.init();
    const storeState = store.getState();
    if (storeState.permissions.get(this.collectionType)) {
      const sources = await Calendar.getSourcesAsync();
      if (storeState.settings.ranWizrd) {
        this.localSource = sources.find((source) => source.id === storeState.settings.syncCalendarsSource)!;
      } else {
        this.localSource = sources.find((source) => (source?.name?.toLowerCase() === ACCOUNT_NAME))!;
      }

      if (storeState.settings.syncCalendarsSource && !this.localSource) {
        throw new Error("Calendar: failed to find selected source. Please contact developers.");
      }
      this.canSync = !!this.localSource;
    }

    if (!this.canSync) {
      logger.info(`Could not find local account for ${this.collectionType}`);
    }
  }

  protected async createJournal(collection: Etebase.CollectionMetadata): Promise<string> {
    const localSource = this.localSource;

    return Calendar.createCalendarAsync({
      sourceId: localSource.id,
      entityType: this.entityType,
      title: collection.name,
      color: collection.color ?? defaultColor,
    });
  }

  protected async updateJournal(containerLocalId: string, collection: Etebase.CollectionMetadata) {
    const localSource = this.localSource;

    await Calendar.updateCalendarAsync(containerLocalId, {
      sourceId: localSource.id,
      title: collection.name,
      color: collection.color ?? defaultColor,
    });
  }

  protected async deleteJournal(containerLocalId: string) {
    return Calendar.deleteCalendarAsync(containerLocalId);
  }
}


export class SyncManagerCalendar extends SyncManagerCalendarBase<EventType, NativeEvent> {
  protected collectionType = "etebase.vevent";
  protected entityType = Calendar.EntityTypes.EVENT;

  protected async syncPush() {
    const storeState = store.getState();
    const decryptedCollections = storeState.cache2.decryptedCollections;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncStateEntries = storeState.sync.stateEntries;
    const now = new Date();
    const dateYearRange = 4; // Maximum year range supported on iOS

    for (const [uid, { meta }] of decryptedCollections.entries()) {
      if (meta.type !== this.collectionType) {
        continue;
      }

      const handled = {};
      logger.info(`Pushing ${uid}`);

      const syncStateEntriesReverse = syncStateEntries.get(uid)!.mapEntries((_entry) => {
        const entry = _entry[1];
        return [entry.localId, entry];
      }).asMutable();

      const pushEntries: PushEntry[] = [];

      const existingEventsGroups = [];
      const syncStateJournal = syncStateJournals.get(uid)!;
      const localId = syncStateJournal.localId;
      for (let i = -2 ; i <= 1 ; i++) {
        const eventsRangeStart = new Date(new Date().setFullYear(now.getFullYear() + (i * dateYearRange)));
        const eventsRangeEnd = new Date(new Date().setFullYear(now.getFullYear() + ((i + 1) * dateYearRange)));

        existingEventsGroups.push(calculateHashesForEvents(localId, eventsRangeStart, eventsRangeEnd));
      }

      for (const existingEvents of existingEventsGroups) {
        for (const [eventId, eventHash] of await existingEvents) {
          if (handled[eventId]) {
            continue;
          }
          handled[eventId] = true;

          const syncStateEntry = syncStateEntriesReverse.get(eventId);

          if (syncStateEntry?.lastHash !== eventHash) {
            const _event = await Calendar.getEventAsync(eventId);
            const event = { ..._event, uid: (syncStateEntry) ? syncStateEntry.uid : _event.id };
            const pushEntry = await this.syncPushHandleAddChange(syncStateJournal, syncStateEntry, event, eventHash);
            if (pushEntry) {
              pushEntries.push(pushEntry);
            }
          }

          if (syncStateEntry) {
            syncStateEntriesReverse.delete(eventId);
          }
        }
      }

      for (const syncStateEntry of syncStateEntriesReverse.values()) {
        // Deleted
        let existingEvent: Calendar.Event | undefined;
        try {
          existingEvent = await Calendar.getEventAsync(syncStateEntry.localId);
        } catch (e) {
          // Skip
        }

        let shouldDelete = !existingEvent;
        if (existingEvent) {
          // FIXME: handle the case of the event still existing and on the same calendar. Probably means we are just not in the range.
          if (existingEvent.calendarId !== localId) {
            shouldDelete = true;
          }
        }

        if (shouldDelete) {
          const pushEntry = await this.syncPushHandleDeleted(syncStateJournal, syncStateEntry);
          if (pushEntry) {
            pushEntries.push(pushEntry);
          }
        }
      }

      await this.pushJournalEntries(syncStateJournal, pushEntries);
    }
  }

  protected contentToVobject(content: string) {
    return EventType.parse(content);
  }

  protected vobjectToNative(vobject: EventType) {
    return eventVobjectToNative(vobject) as NativeEvent;
  }

  protected nativeToVobject(nativeItem: NativeEvent) {
    return eventNativeToVobject(nativeItem);
  }

  protected processSyncEntries(containerLocalId: string, batch: [BatchAction, NativeEvent][]): Promise<HashDictionary> {
    return processEventsChanges(containerLocalId, batch);
  }
}
