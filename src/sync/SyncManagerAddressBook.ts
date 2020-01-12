import * as EteSync from 'etesync';
import * as Contacts from 'expo-contacts';

import { deleteContactGroupAndMembers, calculateHashesForContacts, BatchAction, HashDictionary, processContactsChanges } from '../EteSyncNative';

import { logger } from '../logging';

import { store, SyncStateEntry } from '../store';

import { contactVobjectToNative, NativeContact, contactNativeToVobject } from './helpers';
import { ContactType } from '../pim-types';

import { SyncManagerBase, PushEntry } from './SyncManagerBase';

export class SyncManagerAddressBook extends SyncManagerBase<ContactType, NativeContact> {
  protected collectionType = 'ADDRESS_BOOK';
  private containerId: string;

  public async init() {
    await super.init();
    const storeState = store.getState();
    if (storeState.permissions.get(this.collectionType)) {
      this.containerId = storeState.settings.syncContactsContainer!;
      this.canSync = !!this.containerId;
    }

    if (!this.canSync) {
      logger.info(`Could not find local account for ${this.collectionType}`);
    }
  }

  protected async syncPush() {
    const storeState = store.getState();
    const syncInfoCollections = storeState.cache.syncInfoCollection;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncStateEntries = storeState.sync.stateEntries;

    const syncStateEntriesReverseAll = new Map<string, { collectionUid: string, syncStateEntry: SyncStateEntry }>();

    const pushEntries = new Map<string, PushEntry[]>();

    if (storeState.sync.stateJournals.isEmpty()) {
      // Skip in case we don't have any sync journals (e.g. for associates)
      return;
    }

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

  protected vobjectToNative(vobject: ContactType) {
    return contactVobjectToNative(vobject);
  }

  protected nativeToVobject(nativeItem: NativeContact) {
    return contactNativeToVobject(nativeItem);
  }

  protected processSyncEntries(containerLocalId: string, batch: [BatchAction, NativeContact][]): Promise<HashDictionary> {
    return processContactsChanges(this.containerId, containerLocalId, batch);
  }

  protected async createJournal(collection: EteSync.CollectionInfo): Promise<string> {
    return Contacts.createGroupAsync(collection.displayName);
  }

  protected async updateJournal(containerLocalId: string, collection: EteSync.CollectionInfo) {
    return Contacts.updateGroupNameAsync(collection.displayName, containerLocalId);
  }

  protected async deleteJournal(containerLocalId: string) {
    await deleteContactGroupAndMembers(containerLocalId);
  }
}
