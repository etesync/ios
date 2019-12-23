import * as EteSync from 'etesync';
import * as ICAL from 'ical.js';
import * as Contacts from 'expo-contacts';

import { logger } from '../logging';

import { store, SyncStateJournalEntryData } from '../store';
import { unsetSyncStateJournal } from '../store/actions';

import { contactVobjectToNative, entryNativeHashCalc, NativeContact, contactNativeToVobject } from './helpers';
import { ContactType } from '../pim-types';

import { SyncManagerBase, PushEntry } from './SyncManagerBase';

export class SyncManagerAddressBook extends SyncManagerBase<ContactType, NativeContact> {
  protected collectionType = 'ADDRESS_BOOK';
  private containerId: string;

  public async init() {
    super.init();
    const storeState = store.getState();
    if (storeState.permissions.get(this.collectionType)) {
      this.containerId = await Contacts.getDefaultContainerIdAsync();
      this.canSync = !!this.containerId && storeState.settings.syncContacts;
    }

    if (!this.canSync) {
      logger.info(`Could not find local account for ${this.collectionType}`);
    }
  }

  public async clearDeviceCollections() {
    const etesync = this.etesync;
    const storeState = store.getState();
    const syncStateJournals = storeState.sync.stateJournals;

    return;

    const contacts = (await Contacts.getContactsAsync({ containerId: this.containerId, rawContacts: true })).data;
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
    }));
  }

  protected async syncPush() {
    const storeState = store.getState();
    const syncInfoCollections = storeState.cache.syncInfoCollection;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncStateEntries = storeState.sync.stateEntries;

    for (const collection of syncInfoCollections.values()) {
      const uid = collection.uid;

      if (collection.type !== this.collectionType) {
        continue;
      }

      logger.info(`Pushing ${uid}`);

      const syncStateEntriesReverse = syncStateEntries.get(uid)!.mapEntries((_entry) => {
        const entry = _entry[1];
        return [entry.localId, entry];
      }).asMutable();

      const pushEntries: PushEntry[] = [];

      const syncStateJournal = syncStateJournals.get(uid)!;
      // FIXME: add new contacts to the default address book (group)
      // const localId = syncStateJournal.localId;

      const existingContacts = (await Contacts.getContactsAsync({ containerId: this.containerId, rawContacts: true })).data;
      existingContacts.forEach((_contact) => {
        const syncStateEntry = syncStateEntriesReverse.get(_contact.id);

        const contact = { ..._contact, id: _contact.id, uid: (syncStateEntry) ? syncStateEntry.uid : _contact.id };
        const pushEntry = this.syncPushHandleAddChange(syncStateJournal, syncStateEntry, contact);
        if (pushEntry) {
          pushEntries.push(pushEntry);
        }

        if (syncStateEntry) {
          syncStateEntriesReverse.delete(syncStateEntry.uid);
        }
      });

      for (const syncStateEntry of syncStateEntriesReverse.values()) {
        // Deleted
        let existingContact: Contacts.Contact | undefined;
        try {
          existingContact = await Contacts.getContactByIdAsync(syncStateEntry.localId);
        } catch (e) {
          // Skip
        }

        // FIXME: handle the case of the contact still existing for some reason.
        if (!existingContact) {
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
    return new ContactType(new ICAL.Component(ICAL.parse(syncEntry.content)));
  }

  protected nativeToVobject(nativeItem: NativeContact) {
    return contactNativeToVobject(nativeItem);
  }

  protected nativeHashCalc(contact: NativeContact) {
    return entryNativeHashCalc(contact);
  }

  protected async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateJournalEntryData) {
    const contact = this.syncEntryToVobject(syncEntry);
    const nativeContact = contactVobjectToNative(contact);
    let syncStateEntry = syncStateEntries.get(contact.uid);
    switch (syncEntry.action) {
      case EteSync.SyncEntryAction.Add:
      case EteSync.SyncEntryAction.Change: {
        let contactExists = false;
        try {
          if (syncStateEntry) {
            contactExists = !!(await Contacts.getContactByIdAsync(syncStateEntry.localId));
          }
        } catch (e) {
          // Skip
        }
        if (syncStateEntry && contactExists) {
          nativeContact.id = syncStateEntry.localId;
          await Contacts.updateContactAsync(nativeContact);
        } else {
          const localEntryId = await Contacts.addContactAsync(nativeContact, this.containerId);
          syncStateEntry = {
            uid: nativeContact.uid,
            localId: localEntryId,
            lastHash: '',
          };

          await Contacts.addExistingContactToGroupAsync(localEntryId, containerLocalId);
        }

        const createdContact = { ...(await Contacts.getContactByIdAsync(syncStateEntry.localId))!, uid: nativeContact.uid };
        syncStateEntry.lastHash = this.nativeHashCalc(createdContact);

        break;
      }
      case EteSync.SyncEntryAction.Delete: {
        if (syncStateEntry) {
          // FIXME: Shouldn't have this if, it should just work
          await Contacts.removeContactAsync(syncStateEntry.localId);
        } else {
          syncStateEntry = {
            uid: nativeContact.uid,
            localId: '',
            lastHash: '',
          };
        }
        break;
      }
    }

    return syncStateEntry;
  }

  protected async createJournal(collection: EteSync.CollectionInfo): Promise<string> {
    return Contacts.createGroupAsync(collection.displayName);
  }

  protected async updateJournal(containerLocalId: string, collection: EteSync.CollectionInfo) {
    return Contacts.updateGroupNameAsync(collection.displayName, containerLocalId);
  }

  protected async deleteJournal(containerLocalId: string) {
    return Contacts.removeGroupAsync(containerLocalId);
  }
}
