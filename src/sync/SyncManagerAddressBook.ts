import * as EteSync from '../api/EteSync';
import * as ICAL from 'ical.js';
import { Contacts } from 'expo';

import { logger } from '../logging';

import { SyncInfo, SyncInfoJournal } from '../SyncGate';
import { store, SyncStateEntryData } from '../store';
import { unsetSyncStateJournal, unsetSyncStateEntry } from '../store/actions';

import { contactVobjectToNative, entryNativeHashCalc } from './helpers';
import { ContactType } from '../pim-types';

import { SyncManager } from './SyncManager';

export class SyncManagerAddressBook extends SyncManager {
  protected collectionType = 'ADDRESS_BOOK';

  protected async syncPush(syncInfo: SyncInfo) {
    //
  }

  protected async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateEntryData) {
    const contact = new ContactType(new ICAL.Component(ICAL.parse(syncEntry.content)));
    const nativeContact = contactVobjectToNative(contact);
    let syncStateEntry = syncStateEntries.get(contact.uid);
    switch (syncEntry.action) {
      case EteSync.SyncEntryAction.Add:
      case EteSync.SyncEntryAction.Change:
        let contactExists: boolean;
        try {
          contactExists = (await Contacts.getContactsAsync({
            id: syncStateEntry.localId,
          })).data.length > 0;
        } catch (e) {
          // Skip
        }
        if (syncStateEntry && contactExists) {
          nativeContact.id = syncStateEntry.localId;
          await Contacts.updateContactAsync(nativeContact);
        } else {
          const localEntryId = await Contacts.addContactAsync(nativeContact);
          syncStateEntry = {
            uid: nativeContact.uid,
            localId: localEntryId,
            lastHash: '',
          };

          await Contacts.addExistingContactToGroupAsync(localEntryId, containerLocalId);
        }

        const createdContact = { ...await Contacts.getContactsAsync({ id: syncStateEntry.localId })[0], uid: nativeContact.uid };
        syncStateEntry.lastHash = entryNativeHashCalc(createdContact);

        break;
      case EteSync.SyncEntryAction.Delete:
        if (syncStateEntry) {
          // FIXME: Shouldn't have this if, it should just work
          await Contacts.removeContactAsync(syncStateEntry.localId);
        }
        break;
    }

    return syncStateEntry;
  }

  protected async createJournal(syncJournal: SyncInfoJournal): Promise<string> {
    const collection = syncJournal.collection;

    return Contacts.createGroupAsync(collection.displayName);
  }

  protected async updateJournal(containerLocalId: string, syncJournal: SyncInfoJournal) {
    const collection = syncJournal.collection;
    return Contacts.updateGroupNameAsync(collection.displayName, containerLocalId);
  }

  protected async deleteJournal(containerLocalId: string) {
    return Contacts.removeGroupAsync(containerLocalId);
  }


  protected async debugReset(syncInfo: SyncInfo) {
    const etesync = this.etesync;
    const syncStateJournals = this.syncStateJournals.asMutable();
    const syncStateEntries = this.syncStateEntries.asMutable();

    const contacts = (await Contacts.getContactsAsync()).data;
    for (const contact of contacts) {
      logger.info(`Deleting ${contact.id}`);
      await Contacts.removeContactAsync(contact.id);
    }

    await Promise.all(syncStateJournals.map(async (journal) => {
      store.dispatch(unsetSyncStateJournal(etesync, journal));
      try {
        await Contacts.getGroupsAsync({ groupId: journal.localId });
        await Contacts.removeGroupAsync(journal.localId);
      } catch (e) {
        logger.warn(e);
      }
      syncStateJournals.delete(journal.uid);
    }));

    syncStateEntries.forEach((entry) => {
      store.dispatch(unsetSyncStateEntry(etesync, entry));
      syncStateEntries.delete(entry.uid);
    });

    this.syncStateJournals = syncStateJournals.asImmutable();
    this.syncStateEntries = syncStateEntries.asImmutable();
  }
}

