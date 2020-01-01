import * as EteSync from 'etesync';
import * as Contacts from 'expo-contacts';

import { deleteContactGroupAndMembers, calculateHashesForContacts, hashContact } from '../EteSyncNative';

import { logger } from '../logging';

import { store, SyncStateJournalEntryData, SyncStateEntry } from '../store';
import { unsetSyncStateJournal } from '../store/actions';

import { contactVobjectToNative, NativeContact, contactNativeToVobject, getLocalContainer } from './helpers';
import { ContactType } from '../pim-types';

import { SyncManagerBase, PushEntry } from './SyncManagerBase';

export class SyncManagerAddressBook extends SyncManagerBase<ContactType, NativeContact> {
  protected collectionType = 'ADDRESS_BOOK';
  private containerId: string;

  public async init() {
    await super.init();
    const storeState = store.getState();
    if (storeState.permissions.get(this.collectionType)) {
      const container = await getLocalContainer();
      if (container) {
        this.containerId = container.id;
        this.canSync = storeState.settings.syncContacts;
      }
    }

    if (!this.canSync) {
      logger.info(`Could not find local account for ${this.collectionType}`);
    }
  }

  public async clearDeviceCollections() {
    const etesync = this.etesync;
    const storeState = store.getState();
    const syncStateJournals = storeState.sync.stateJournals;

    await Promise.all(syncStateJournals.map(async (journal) => {
      store.dispatch(unsetSyncStateJournal(etesync, journal));
      try {
        await deleteContactGroupAndMembers(journal.localId);
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

    const syncStateEntriesReverseAll = new Map<string, { collectionUid: string, syncStateEntry: SyncStateEntry }>();

    const pushEntries = new Map<string, PushEntry[]>();

    // First collect all of the sync entries
    for (const collection of syncInfoCollections.values()) {
      const uid = collection.uid;

      if (collection.type !== this.collectionType) {
        continue;
      }

      syncStateEntries.get(uid)!.forEach((entry) => {
        syncStateEntriesReverseAll.set(entry.localId, { collectionUid: uid, syncStateEntry: entry });
      });

      pushEntries.set(uid, []);
    }

    logger.info(`Preparing pushing of ${this.collectionType}`);

    // FIXME: add new contacts to the default address book (group)
    // const localId = syncStateJournal.localId;
    const defaultCollectionUid = Array.from(pushEntries.keys())[0];

    const existingContacts = await calculateHashesForContacts(this.containerId);
    for (const [contactId, contactHash] of existingContacts) {
      const reverseEntry = syncStateEntriesReverseAll.get(contactId);
      const syncStateEntry = reverseEntry?.syncStateEntry;

      if (syncStateEntry?.lastHash !== contactHash) {
        const collectionUid = reverseEntry?.collectionUid ?? defaultCollectionUid;
        const syncStateJournal = syncStateJournals.get(collectionUid)!;
        const _contact = await Contacts.getContactByIdAsync(contactId);
        const contact = { ..._contact!, id: contactId, uid: (syncStateEntry) ? syncStateEntry.uid : contactId.split(':')[0] };
        const pushEntry = this.syncPushHandleAddChange(syncStateJournal, syncStateEntry, contact, contactHash);
        if (pushEntry) {
          pushEntries.get(collectionUid)!.push(pushEntry);
        }
      }

      if (syncStateEntry) {
        syncStateEntriesReverseAll.delete(syncStateEntry.uid);
      }
    }

    for (const reverseEntry of syncStateEntriesReverseAll.values()) {
      const syncStateEntry = reverseEntry.syncStateEntry;
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
        const syncStateJournal = syncStateJournals.get(reverseEntry.collectionUid)!;
        const pushEntry = this.syncPushHandleDeleted(syncStateJournal, syncStateEntry);
        if (pushEntry) {
          pushEntries.get(reverseEntry.collectionUid)!.push(pushEntry);
        }
      }
    }

    for (const [collectionUid, journalPushEntries] of pushEntries.entries()) {
      logger.info(`Pushing ${collectionUid}`);
      const syncStateJournal = syncStateJournals.get(collectionUid)!;
      await this.pushJournalEntries(syncStateJournal, journalPushEntries);
    }
  }

  protected syncEntryToVobject(syncEntry: EteSync.SyncEntry) {
    return ContactType.parse(syncEntry.content);
  }

  protected nativeToVobject(nativeItem: NativeContact) {
    return contactNativeToVobject(nativeItem);
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

        syncStateEntry.lastHash = await hashContact(syncStateEntry.localId);

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
