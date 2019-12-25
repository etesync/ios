import * as EteSync from 'etesync';
import * as Calendar from 'expo-calendar';

import { logger } from '../logging';

import { store, SyncStateJournalEntryData } from '../store';
import { unsetSyncStateJournal } from '../store/actions';

import { eventVobjectToNative, eventNativeToVobject, entryNativeHashCalc, NativeBase, NativeEvent } from './helpers';
import { colorIntToHtml } from '../helpers';
import { PimType, EventType } from '../pim-types';

import { SyncManagerBase, PushEntry } from './SyncManagerBase';

const ACCOUNT_NAME = 'etesync';

export abstract class SyncManagerCalendarBase<T extends PimType, N extends NativeBase> extends SyncManagerBase<T, N> {
  protected abstract entityType: string;

  protected localSource: Calendar.Source;

  public async init() {
    super.init();
    const storeState = store.getState();
    if (storeState.permissions.get(this.collectionType)) {
      this.localSource = (await Calendar.getSourcesAsync()).find((source) => (source.name.toLowerCase() === ACCOUNT_NAME))!;
      this.canSync = !!this.localSource;
    }

    if (!this.canSync) {
      logger.info(`Could not find local account for ${this.collectionType}`);
    }
  }

  public async clearDeviceCollections() {
    const storeState = store.getState();
    const etesync = this.etesync;
    const localSource = this.localSource;
    const syncStateJournals = storeState.sync.stateJournals;

    const calendars = await Calendar.getCalendarsAsync(this.entityType);
    for (const calendar of calendars) {
      if (calendar.source.id === localSource.id) {
        logger.info(`Deleting ${calendar.title}`);
        await Calendar.deleteCalendarAsync(calendar.id);
      }
    }

    syncStateJournals.forEach((journal) => {
      store.dispatch(unsetSyncStateJournal(etesync, journal));
    });
  }

  protected async createJournal(collection: EteSync.CollectionInfo): Promise<string> {
    const localSource = this.localSource;

    return Calendar.createCalendarAsync({
      sourceId: localSource.id,
      entityType: this.entityType,
      title: collection.displayName,
      color: colorIntToHtml(collection.color),
    });
  }

  protected async updateJournal(containerLocalId: string, collection: EteSync.CollectionInfo) {
    const localSource = this.localSource;

    await Calendar.updateCalendarAsync(containerLocalId, {
      sourceId: localSource.id,
      title: collection.displayName,
      color: colorIntToHtml(collection.color),
    });
  }

  protected async deleteJournal(containerLocalId: string) {
    return Calendar.deleteCalendarAsync(containerLocalId);
  }
}


export class SyncManagerCalendar extends SyncManagerCalendarBase<EventType, NativeEvent> {
  protected collectionType = 'CALENDAR';
  protected entityType = Calendar.EntityTypes.EVENT;

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

      const pushEntries: PushEntry[] = [];

      const existingEventsGroups = [];
      const syncStateJournal = syncStateJournals.get(uid)!;
      const localId = syncStateJournal.localId;
      for (let i = -2 ; i <= 1 ; i++) {
        const eventsRangeStart = new Date(new Date().setFullYear(now.getFullYear() + (i * dateYearRange)));
        const eventsRangeEnd = new Date(new Date().setFullYear(now.getFullYear() + ((i + 1) * dateYearRange)));

        existingEventsGroups.push(Calendar.getEventsAsync([localId], eventsRangeStart, eventsRangeEnd));
      }

      for (const existingEvents of existingEventsGroups) {
        (await existingEvents).forEach((_event) => {
          if (handled[_event.id]) {
            return;
          }
          handled[_event.id] = true;

          const syncStateEntry = syncStateEntriesReverse.get(_event.id);

          const event = { ..._event, uid: (syncStateEntry) ? syncStateEntry.uid : _event.id };
          const pushEntry = this.syncPushHandleAddChange(syncStateJournal, syncStateEntry, event);
          if (pushEntry) {
            pushEntries.push(pushEntry);
          }

          if (syncStateEntry) {
            syncStateEntriesReverse.delete(syncStateEntry.uid);
          }
        });
      }

      for (const syncStateEntry of syncStateEntriesReverse.values()) {
        // Deleted
        let existingEvent: Calendar.Event | undefined;
        try {
          existingEvent = await Calendar.getEventAsync(syncStateEntry.localId);
        } catch (e) {
          // Skip
        }

        // FIXME: handle the case of the event still existing for some reason.
        if (!existingEvent) {
          // If the event still exists it means it's not deleted.
          const pushEntry = this.syncPushHandleDeleted(syncStateJournal, syncStateEntry);
          if (pushEntry) {
            pushEntries.push(pushEntry);
          }
        }
      }

      await this.pushJournalEntries(syncStateJournal, pushEntries);
    }
  }

  protected syncEntryToVobject(syncEntry: EteSync.SyncEntry) {
    return EventType.parse(syncEntry.content);
  }

  protected nativeToVobject(nativeItem: NativeEvent) {
    return eventNativeToVobject(nativeItem);
  }

  protected nativeHashCalc(event: NativeEvent) {
    return entryNativeHashCalc(event);
  }

  protected async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateJournalEntryData) {
    const event = this.syncEntryToVobject(syncEntry);
    const nativeEvent = eventVobjectToNative(event);
    let syncStateEntry = syncStateEntries.get(event.uid);
    switch (syncEntry.action) {
      case EteSync.SyncEntryAction.Add:
      case EteSync.SyncEntryAction.Change: {
        let existingEvent: Calendar.Event | undefined;
        try {
          if (syncStateEntry) {
            existingEvent = await Calendar.getEventAsync(syncStateEntry.localId);
          }
        } catch (e) {
          // Skip
        }
        if (syncStateEntry && existingEvent) {
          await Calendar.updateEventAsync(syncStateEntry.localId, nativeEvent, {
            futureEvents: true,
          });
        } else {
          const localEntryId = await Calendar.createEventAsync(containerLocalId, nativeEvent);
          syncStateEntry = {
            uid: nativeEvent.uid,
            localId: localEntryId,
            lastHash: '',
          };
        }

        const createdEvent = { ...await Calendar.getEventAsync(syncStateEntry.localId), uid: nativeEvent.uid };
        syncStateEntry.lastHash = this.nativeHashCalc(createdEvent);

        break;
      }
      case EteSync.SyncEntryAction.Delete: {
        if (syncStateEntry) {
          // FIXME: Shouldn't have this if, it should just work
          await Calendar.deleteEventAsync(syncStateEntry.localId, {
            futureEvents: true,
          });
        } else {
          syncStateEntry = {
            uid: nativeEvent.uid,
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
