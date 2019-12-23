import * as EteSync from 'etesync';
import * as ICAL from 'ical.js';
import * as Contacts from 'expo-contacts';

import { logger } from '../logging';

import { store, SyncStateJournalEntryData } from '../store';
import { unsetSyncStateJournal } from '../store/actions';

import { contactVobjectToNative, entryNativeHashCalc, NativeContact } from './helpers';
import { ContactType } from '../pim-types';

import { SyncManagerBase } from './SyncManagerBase';

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
    }));
  }

  protected async syncPush() {
    //
  }

  protected syncEntryToVobject(syncEntry: EteSync.SyncEntry) {
    return new ContactType(new ICAL.Component(ICAL.parse(syncEntry.content)));
  }

  protected nativeToVobject(_nativeItem: NativeContact) {
    return {} as ContactType;
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
            contactExists = (await Contacts.getContactsAsync({
              id: syncStateEntry.localId,
            })).data.length > 0;
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

        const createdContact = { ...(await Contacts.getContactsAsync({ id: syncStateEntry.localId })).data[0], uid: nativeContact.uid };
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
