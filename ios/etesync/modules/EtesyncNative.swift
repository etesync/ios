import Foundation
import UIKit
import EventKit
import Contacts

@objc(EteSyncNative)
class EteSyncNative: NSObject {
    let taskQueue = DispatchQueue(label: "com.etesync.DispatchQueue", attributes: .concurrent)
    
    @objc(hashEvent:resolve:reject:)
    func hashEvent(eventId: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        let store = EKEventStore()
        if let event = store.calendarItem(withIdentifier: eventId) as! EKEvent? {
            resolve(etesync.hashEvent(event: event))
        } else {
            reject("no_event", String(format: "Event with identifier %@ not found", eventId), nil)
        }
    }
    
    @objc(calculateHashesForEvents:from:to:resolve:reject:)
    func calculateHashesForEvents(calendarId: String, from: NSNumber, to: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        taskQueue.async {
            let store = EKEventStore()
            guard let cal = store.calendar(withIdentifier: calendarId) else {
                reject("no_calendar", String(format: "Calendar with identifier %@ not found", calendarId), nil)
                return
            }
            
            let start = Date(timeIntervalSince1970: TimeInterval(from.doubleValue))
            let end = Date(timeIntervalSince1970: TimeInterval(to.doubleValue))
            
            let predicate = store.predicateForEvents(withStart: start, end: end, calendars: [cal])
            
            let events = store.events(matching: predicate)
            
            var handled = Set<String>()
            var ret: [Any] = []
            
            for event in events {
                if (handled.contains(event.calendarItemIdentifier)) {
                    continue
                }
                handled.insert(event.calendarItemIdentifier)
                
                ret.append([
                    event.calendarItemIdentifier,
                    etesync.hashEvent(event: event)
                ])
            }
            
            resolve(ret)
        }
    }
    
    @objc(hashReminder:resolve:reject:)
    func hashReminder(reminderId: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        let store = EKEventStore()
        if let reminder = store.calendarItem(withIdentifier: reminderId) as! EKReminder? {
            resolve(etesync.hashReminder(reminder: reminder))
        } else {
            reject("no_reminder", String(format: "Reminder with identifier %@ not found", reminderId), nil)
        }
    }
    
    @objc(calculateHashesForReminders:resolve:reject:)
    func calculateHashesForReminders(calendarId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        taskQueue.async {
            let store = EKEventStore()
            guard let cal = store.calendar(withIdentifier: calendarId) else {
                reject("no_calendar", String(format: "Calendar with identifier %@ not found", calendarId), nil)
                return
            }
            
            let predicate = store.predicateForReminders(in: [cal])
            
            store.fetchReminders(matching: predicate, completion: { reminders in
                if (reminders == nil) {
                    resolve([])
                    return
                }

                resolve(reminders!.map{ reminder in
                    [
                        reminder.calendarItemIdentifier,
                        etesync.hashReminder(reminder: reminder)
                    ]
                })
            })
        }
    }
    
    static let keysToFetch = [
        CNContactIdentifierKey,
        CNContactTypeKey,
        CNContactPropertyAttribute,
        CNContactNamePrefixKey,
        CNContactGivenNameKey,
        CNContactMiddleNameKey,
        CNContactFamilyNameKey,
        CNContactPreviousFamilyNameKey,
        CNContactNameSuffixKey,
        CNContactNicknameKey,
        CNContactJobTitleKey,
        CNContactDepartmentNameKey,
        CNContactOrganizationNameKey,
        CNContactPostalAddressesKey,
        CNContactEmailAddressesKey,
        CNContactUrlAddressesKey,
        CNContactInstantMessageAddressesKey,
        CNContactPhoneNumbersKey,
        CNContactBirthdayKey,
        CNContactDatesKey,
        // CNContactNoteKey,
        CNContactImageDataAvailableKey,
        CNContactThumbnailImageDataKey,
        CNContactRelationsKey,
        CNContactInstantMessageAddressesKey,
    ] as [CNKeyDescriptor]
    
    private class func getFetchRequest(predicate: NSPredicate) -> CNContactFetchRequest {
        let fetchRequest = CNContactFetchRequest(keysToFetch: EteSyncNative.keysToFetch)
        fetchRequest.unifyResults = false
        fetchRequest.predicate = predicate
        return fetchRequest
    }

    @objc(hashContact:resolve:reject:)
    func hashContact(contactId: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        let store = CNContactStore()
        let predicate = CNContact.predicateForContacts(withIdentifiers: [contactId])
        let fetchRequest = EteSyncNative.getFetchRequest(predicate: predicate)
        
        var ret: String? = nil
        do {
            try store.enumerateContacts(with: fetchRequest, usingBlock: { (contact, _) in
                ret = etesync.hashContact(contact: contact)
            })
        } catch {
            reject("fetch_failed", "Failed fethcing contact", error)
            return
        }
        
        if (ret == nil) {
            reject("not_found", String(format: "Contact with id %@ not found", contactId), nil)
        }
        
        resolve(ret)
    }
    
    @objc(calculateHashesForContacts:resolve:reject:)
    func calculateHashesForContacts(containerId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        taskQueue.async {
            let store = CNContactStore()
            let predicate = CNContact.predicateForContactsInContainer(withIdentifier: containerId)
            let fetchRequest = EteSyncNative.getFetchRequest(predicate: predicate)
            
            var ret: [[String]] = []
            do {
                try store.enumerateContacts(with: fetchRequest, usingBlock: { (contact, _) in
                    ret.append([
                        contact.identifier,
                        etesync.hashContact(contact: contact)
                    ])
                })
            } catch {
                reject("fetch_failed", "Failed fethcing contacts", error)
                return
            }
            
            resolve(ret)
        }
    }
    
    @objc(processContactsChanges:changes:resolve:reject:)
    func processContactsChanges(containerId: String, changes: Array<Array<Any>>, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        taskQueue.async {
            let ActionAdd = 1
            let ActionChange = 2
            let ActionDelete = 3

            let store = CNContactStore()
            
            var fetchedContacts = Dictionary<String, CNMutableContact>()
            var fetchContactsIds: [String] = []
            
            for change in changes {
                let action = change[0] as! Int
                let item = change[1] as! Dictionary<String, Any>
                
                if (action == ActionChange || action == ActionDelete) {
                    let identifier = item["id"] as! String
                    fetchContactsIds.append(identifier)
                }
            }
            
            if (!fetchContactsIds.isEmpty) {
                let predicate = CNContact.predicateForContacts(withIdentifiers: fetchContactsIds)
                let fetchRequest = EteSyncNative.getFetchRequest(predicate: predicate)
                fetchRequest.mutableObjects = true
                
                do {
                    try store.enumerateContacts(with: fetchRequest, usingBlock: { (contact, _) in
                        fetchedContacts[contact.identifier] = (contact as! CNMutableContact)
                    })
                } catch {
                    reject("fetch_failed", "Failed fethcing contacts", error)
                    return
                }
            }
            
            var addChangeContacts: [CNMutableContact] = []
            var ret: [[String]] = []
            
            let saveRequest = CNSaveRequest()
            
            for change in changes {
                let action = change[0] as! Int
                let item = change[1] as! Dictionary<String, Any>
                let identifier = item["id"] as! String? ?? "NOTFOUND"
                let contact = fetchedContacts[identifier] ?? CNMutableContact()
                mutateContact(contact: contact, data: item)
                
                switch (action) {
                case ActionAdd:
                    saveRequest.add(contact, toContainerWithIdentifier: containerId)
                    addChangeContacts.append(contact)
                case ActionChange:
                    saveRequest.update(contact)
                    addChangeContacts.append(contact)
                case ActionDelete:
                    saveRequest.delete(contact)
                default:
                    reject("unrecognized_action", "Failed processing unrecognized action", nil)
                    return
                }
            }

            do {
                try store.execute(saveRequest)
            } catch {
                reject("failed_poccessing_changes", "Failed processing contacts changes", error)
                return
            }
            
            for contact in addChangeContacts {
                ret.append([
                    contact.identifier,
                    etesync.hashContact(contact: contact)
                ])
            }

            resolve(ret)
        }
    }
    
    @objc(deleteContactGroupAndMembers:resolve:reject:)
    func deleteContactGroupAndMembers(groupId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        taskQueue.async {
            var count = 0;
            let store = CNContactStore()
            var group: CNGroup;
            do {
                let groups = try store.groups(matching: CNGroup.predicateForGroups(withIdentifiers: [groupId]))
                if let gr = groups.first {
                    group = gr
                } else {
                    reject("fetch_group", "Failed fetching group", nil)
                    return
                }
            } catch {
                reject("fetch_group", "Failed fetching group", error)
                return
            }
            let predicate = CNContact.predicateForContactsInGroup(withIdentifier: groupId)
            let fetchRequest = CNContactFetchRequest(keysToFetch: [CNContactIdentifierKey] as [CNKeyDescriptor])
            fetchRequest.unifyResults = false
            fetchRequest.mutableObjects = true
            fetchRequest.predicate = predicate
            
            let saveRequest = CNSaveRequest()
            do {
                try store.enumerateContacts(with: fetchRequest, usingBlock: { (contact, _) in
                    saveRequest.delete(contact as! CNMutableContact)
                    count += 1
                })
            } catch {
                reject("fetch_deletion_failed", "Failed fethcing contacts for deletion", error)
                return
            }
            
            saveRequest.delete(group.mutableCopy() as! CNMutableGroup)
            
            do {
                try store.execute(saveRequest)
            } catch {
                reject("failed_deletion", "Failed deleting contacts", error)
                return
            }
            
            resolve(count)
        }
    }
    
    @objc(getContainers:reject:)
    func getContainers(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        let store = CNContactStore()
        do {
            let containers = try store.containers(matching: nil)
            let defaultContainerId = store.defaultContainerIdentifier()
            var ret: [Any] = []
            
            for container in containers {
                var typeStr: String
                switch (container.type) {
                case .cardDAV:
                    typeStr = "cardDAV"
                case .exchange:
                    typeStr = "exchange"
                case .local:
                    typeStr = "local"
                default:
                    typeStr = "unassigned"
                }
                ret.append([
                    "name": container.name,
                    "id": container.identifier,
                    "type": typeStr,
                    "default": container.identifier == defaultContainerId
                ])
            }
            
            resolve(ret)
        } catch {
            reject("default_container_load_error", "Could not load default container.", error)
        }
    }

    @objc(beginBackgroundTask:resolve:reject:)
    func beginBackgroundTask(name: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        var backgroundTaskId: [UIBackgroundTaskIdentifier] = []
        backgroundTaskId.append(UIApplication.shared.beginBackgroundTask (withName: name) {
            UIApplication.shared.endBackgroundTask(backgroundTaskId.first!)
            backgroundTaskId[0] = UIBackgroundTaskIdentifier.invalid
        })
        
        resolve(backgroundTaskId[0].rawValue)
    }
    
    @objc(endBackgroundTask:)
    func endBackgroundTask(taskId: NSNumber) {
        UIApplication.shared.endBackgroundTask(UIBackgroundTaskIdentifier(rawValue: taskId.intValue))
    }
    
    @objc
    func playground() {
    }
}
