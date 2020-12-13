// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as Etebase from "etebase";
import * as Contacts from "expo-contacts";

import { deleteContactGroupAndMembers, calculateHashesForContacts, BatchAction, HashDictionary, processContactsChanges, getContainers } from "../EteSyncNative";

import { logger } from "../logging";

import { store, SyncStateEntry } from "../store";

import { contactVobjectToNative, NativeContact, contactNativeToVobject } from "./helpers";
import { ContactType } from "../pim-types";

import { SyncManagerBase, PushEntry } from "./SyncManagerBase";

const fieldTypes = [
  Contacts.Fields.ID,
  Contacts.Fields.ContactType,
  Contacts.Fields.Name,
  Contacts.Fields.FirstName,
  Contacts.Fields.MiddleName,
  Contacts.Fields.LastName,
  Contacts.Fields.MaidenName,
  Contacts.Fields.NamePrefix,
  Contacts.Fields.NameSuffix,
  Contacts.Fields.Nickname,
  // Contacts.Fields.PhoneticFirstName,
  // Contacts.Fields.PhoneticMiddleName,
  // Contacts.Fields.PhoneticLastName,
  Contacts.Fields.Birthday,
  // Contacts.Fields.NonGregorianBirthday,
  Contacts.Fields.Emails,
  Contacts.Fields.PhoneNumbers,
  Contacts.Fields.Addresses,
  Contacts.Fields.SocialProfiles,
  Contacts.Fields.InstantMessageAddresses,
  Contacts.Fields.UrlAddresses,
  Contacts.Fields.Company,
  Contacts.Fields.JobTitle,
  Contacts.Fields.Department,
  Contacts.Fields.ImageAvailable,
  Contacts.Fields.Image,
  "imageBase64",
  // Contacts.Fields.RawImage,
  Contacts.Fields.ExtraNames,
  Contacts.Fields.Note,
  Contacts.Fields.Dates,
  Contacts.Fields.Relationships,
];

export class SyncManagerAddressBook extends SyncManagerBase<ContactType, NativeContact> {
  protected collectionType = "etebase.vcard";
  protected collectionTypeDisplay = "Address Book";
  private containerId: string;

  public async init() {
    await super.init();
    const storeState = store.getState();
    if (storeState.permissions.get("ADDRESS_BOOK")) {
      const containers = await getContainers();
      if (storeState.settings.syncContactsContainer) {
        const foundContainer = containers.find((container) => container.id === storeState.settings.syncContactsContainer);
        if (foundContainer) {
          this.containerId = foundContainer.id;
        } else {
          throw new Error(`AddressBook: failed to find selected container ${storeState.settings.syncContactsContainer}. Please contact developers.`);
        }
      }
      this.canSync = !!this.containerId;
    }

    if (!this.canSync) {
      logger.info(`Could not find local account for ${this.collectionType}`);
    }
  }

  protected async syncPush() {
    const storeState = store.getState();
    const decryptedCollections = storeState.cache2.decryptedCollections;
    const syncStateJournals = storeState.sync.stateJournals;
    const syncStateEntries = storeState.sync.stateEntries;

    const syncStateEntriesReverseAll = new Map<string, { collectionUid: string, syncStateEntry: SyncStateEntry }>();

    const pushEntries = new Map<string, PushEntry[]>();

    // First collect all of the sync entries
    for (const [uid, { collectionType }] of decryptedCollections.entries()) {
      if (collectionType !== this.collectionType) {
        continue;
      }

      syncStateEntries.get(uid)!.forEach((entry) => {
        syncStateEntriesReverseAll.set(entry.localId, { collectionUid: uid, syncStateEntry: entry });
      });

      pushEntries.set(uid, []);
    }

    if (pushEntries.size === 0) {
      // Skip in case we don't have any sync journals (e.g. for associates)
      logger.debug(`Skipping sync of ${this.collectionType} (no collections)`);
      return;
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
        if (!syncStateJournal) {
          logger.warn(`Failed finding syncStateJournal for ${collectionUid}. Options: ${Array.from(syncStateJournals.keys())}`);
        }
        const _contact = await Contacts.getContactByIdAsync(contactId, fieldTypes as any);
        const contact = { ..._contact!, id: contactId, uid: (syncStateEntry) ? syncStateEntry.uid : contactId.split(":")[0] };
        const pushEntry = await this.syncPushHandleAddChange(syncStateJournal, syncStateEntry, contact, contactHash);
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
        existingContact = await Contacts.getContactByIdAsync(syncStateEntry.localId, fieldTypes as any);
      } catch (e) {
        // Skip
      }

      // FIXME: handle the case of the contact still existing for some reason.
      if (!existingContact) {
        // If the event still exists it means it's not deleted.
        const syncStateJournal = syncStateJournals.get(reverseEntry.collectionUid)!;
        const pushEntry = await this.syncPushHandleDeleted(syncStateJournal, syncStateEntry);
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

  protected contentToVobject(content: string) {
    return ContactType.parse(content);
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

  protected async createJournal(collection: Etebase.ItemMetadata): Promise<string> {
    return Contacts.createGroupAsync(collection.name);
  }

  protected async updateJournal(containerLocalId: string, collection: Etebase.ItemMetadata) {
    return Contacts.updateGroupNameAsync(collection.name!, containerLocalId);
  }

  protected async deleteJournal(containerLocalId: string) {
    await deleteContactGroupAndMembers(containerLocalId);
  }
}
