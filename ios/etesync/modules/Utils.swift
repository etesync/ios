//
//  Utils.swift
//  etesync
//
//  Created by Me Me on 26/12/2019.
//  Copyright © 2019 650 Industries, Inc. All rights reserved.
//

import Foundation
import EventKit
import Contacts
import CommonCrypto
import MessagePack

class Sha256 {
    private var ctx = UnsafeMutablePointer<CC_SHA256_CTX>.allocate(capacity: 1)
    
    init() {
        CC_SHA256_Init(ctx)
    }
    
    func update(data: Data) {
        data.withUnsafeBytes({
            _ = CC_SHA256_Update(ctx, $0.baseAddress, CC_LONG(data.count))
        })
    }
    
    func update(string: String) {
        self.update(data: string.data(using: .utf8)!)
    }

    func update(date: Date) {
        self.update(timeInterval: date.timeIntervalSince1970)
    }
    
    func update(timeInterval: TimeInterval) {
        var interval = timeInterval
        CC_SHA256_Update(ctx, &interval, CC_LONG(MemoryLayout<TimeInterval>.size))
    }
    
    func update(bool: Bool) {
        self.update(data: Data(repeating: (bool) ? 1 : 0, count: 1))
    }
    
    func update(number: Int) {
        var num = number
        CC_SHA256_Update(ctx, &num, CC_LONG(MemoryLayout<Int>.size))
    }
    
    func finalize() -> String {
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        hash.withUnsafeMutableBufferPointer({
            _ = CC_SHA256_Final($0.baseAddress, ctx)
        })
        return hash.map({ String(format: "%02hhx", $0) }).joined()
    }
}

private func sortMessagePackArray(arr: [MessagePackValue]) -> [MessagePackValue] {
    return arr.sorted{
        let a = pack($0).base64EncodedString()
        let b = pack($1).base64EncodedString()
        return a < b
    }
}

private func stringOrNull(str: String?) -> MessagePackValue {
    if let string = str {
        return .string(string)
    } else {
        return (.nil)
    }
}

private func dateComponentsOrNull(dateComponents: DateComponents?) -> MessagePackValue {
    if let comps = dateComponents {
        return .array([
            .int(Int64(comps.year ?? 0)),
            .int(Int64(comps.month ?? 0)),
            .int(Int64(comps.day ?? 0))
        ])
    } else {
        return (.nil)
    }
}

private func dateOrNull(date: Date?, isAllDay: Bool) -> MessagePackValue {
    let dayInterval = 60 * 60 * 24
    if var d = date {
        if (isAllDay) {
            d = d.addingTimeInterval(TimeInterval(dayInterval - 60)) // Add just shy of 24hrs
            let adjustedDate = Int(d.timeIntervalSince1970) - (Int(d.timeIntervalSince1970) % dayInterval)
            return .int(Int64(adjustedDate))
        } else {
            return .double(d.timeIntervalSince1970)
        }
    } else {
        return (.nil)
    }
}

private func numberArrayOrNull(array: [NSNumber]?) -> MessagePackValue {
    if let arr = array {
        return .array(sortMessagePackArray(arr: arr.map{ .int($0.int64Value) }))
    } else {
        return .nil
    }
}

private func weekdaysArrayOrNull(weekdays: [EKRecurrenceDayOfWeek]?) -> MessagePackValue {
    if let arr = weekdays {
        return .array(sortMessagePackArray(arr: arr.map{
            .array([
                .int(Int64($0.dayOfTheWeek.rawValue)),
                .int(Int64($0.weekNumber)),
            ])
        }))
    } else {
        return .nil
    }
}
private func hashCalendarItem(item: EKCalendarItem, isAllDay: Bool) -> [MessagePackValue] {
    var msg = [MessagePackValue](repeating: 0, count: 0)

    /* Skip values that can't change (and last modified date which is redundant for our purposes)
     sha.update(string: item.itemIdentifier)
     sha.update(string: item.calendar.calendarIdentifier)
     
     if let creationDate = item.creationDate {
     sha.update(date: creationDate)
     } else {
     sha.update(string: missing)
     }
     if let lastModifiedDate = item.lastModifiedDate {
     sha.update(date: lastModifiedDate)
     } else {
     sha.update(string: missing)
     }
     */
    
    msg.append(stringOrNull(str: item.title))
    msg.append(stringOrNull(str: item.location))
    msg.append(stringOrNull(str: item.timeZone?.identifier))
    msg.append(stringOrNull(str: item.url?.absoluteString))

    if item.hasNotes, let notes = item.notes {
        msg.append(.string(notes))
    } else {
        msg.append(.nil)
    }
    
    if item.hasAttendees, let attendees = item.attendees {
        msg.append(.array(sortMessagePackArray(arr: attendees.map {
            .array([
                stringOrNull(str: $0.name),
                .string($0.url.absoluteString)
            ])
        })))
    } else {
        msg.append(.nil)
    }
    
    if item.hasAlarms, let alarms = item.alarms {
        msg.append(.array(sortMessagePackArray(arr: alarms.map {
            .array([
                .double($0.relativeOffset),
                dateOrNull(date: $0.absoluteDate, isAllDay: false)
            ])
        })))
    } else {
        msg.append(.nil)
    }
    
    if item.hasRecurrenceRules, let recurrenceRules = item.recurrenceRules {
        msg.append(.array(sortMessagePackArray(arr: recurrenceRules.map {
            .array([
                .int(Int64($0.frequency.rawValue)),
                .int(Int64($0.interval)),
                weekdaysArrayOrNull(weekdays: $0.daysOfTheWeek),
                numberArrayOrNull(array: $0.daysOfTheMonth),
                numberArrayOrNull(array: $0.daysOfTheYear),
                numberArrayOrNull(array: $0.weeksOfTheYear),
                numberArrayOrNull(array: $0.monthsOfTheYear),
                numberArrayOrNull(array: $0.setPositions),
                .int(Int64($0.recurrenceEnd?.occurrenceCount ?? 0)),
                dateOrNull(date: $0.recurrenceEnd?.endDate, isAllDay: isAllDay)
            ])
        })))
    } else {
        msg.append(.nil)
    }
    
    return msg
}

func versionHash(hash: String) -> String {
    let hashVersionTag = "1"
    return String(format: "%@:%@", hashVersionTag, hash)
}

func hashEvent(event: EKEvent) -> String {
    var msg = hashCalendarItem(item: event, isAllDay: event.isAllDay)
    
    msg.append(.int(Int64(event.availability.rawValue)))
    msg.append(stringOrNull(str: event.organizer?.url.absoluteString))
    msg.append(dateOrNull(date: event.startDate, isAllDay: event.isAllDay))
    msg.append(dateOrNull(date: event.endDate, isAllDay: event.isAllDay))
    msg.append(dateOrNull(date: event.occurrenceDate, isAllDay: event.isAllDay))
    msg.append(.bool(event.isAllDay))
    msg.append(.bool(event.isDetached))
    msg.append(.int(Int64(event.status.rawValue)))

    let sha = Sha256()

    sha.update(data: pack(.array(msg)))

    return versionHash(hash: sha.finalize())
}

func hashReminder(reminder: EKReminder) -> String {
    var msg = hashCalendarItem(item: reminder, isAllDay: false)
    
    msg.append(dateComponentsOrNull(dateComponents: reminder.startDateComponents))
    msg.append(dateComponentsOrNull(dateComponents: reminder.dueDateComponents))
    msg.append(.bool(reminder.isCompleted))
    msg.append(dateOrNull(date: reminder.completionDate, isAllDay: false))
    msg.append(.int(Int64(reminder.priority)))
    
    let sha = Sha256()
    
    sha.update(data: pack(.array(msg)))
    
    return versionHash(hash: sha.finalize())
}

func hashContact(contact: CNContact) -> String {
    var msg = [MessagePackValue](repeating: 0, count: 0)

    msg.append(dateComponentsOrNull(dateComponents: contact.birthday))
    msg.append(.string(contact.departmentName))
    msg.append(.string(contact.familyName))
    msg.append(.string(contact.givenName))
    msg.append(.string(contact.jobTitle))
    msg.append(.string(contact.middleName))
    msg.append(.string(contact.namePrefix))
    msg.append(.string(contact.nameSuffix))
    msg.append(.string(contact.nickname))
    msg.append(.string(contact.organizationName))
    msg.append(.string(contact.previousFamilyName))
    
    msg.append(.array(sortMessagePackArray(arr: contact.dates.map{
        var dateComponents = DateComponents()
        dateComponents.year = $0.value.year
        dateComponents.month = $0.value.month
        dateComponents.day = $0.value.day
        
        return [
            stringOrNull(str: $0.label),
            dateComponentsOrNull(dateComponents: dateComponents)
        ]
    })))
    
    msg.append(.array(sortMessagePackArray(arr: contact.emailAddresses.map{
        [
            stringOrNull(str: $0.label),
            .string(String($0.value))
        ]
    })))
    
    msg.append(.array(sortMessagePackArray(arr: contact.instantMessageAddresses.map{
        [
            stringOrNull(str: $0.label),
            .string($0.value.service),
            .string($0.value.username)
        ]
    })))
    
    msg.append(.array(sortMessagePackArray(arr: contact.phoneNumbers.map{
        [
            stringOrNull(str: $0.label),
            .string($0.value.stringValue),
        ]
    })))
    
    msg.append(.array(sortMessagePackArray(arr: contact.postalAddresses.map{
        [
            stringOrNull(str: $0.label),
            .string($0.value.city),
            .string($0.value.country),
            .string($0.value.postalCode),
            .string($0.value.state),
            .string($0.value.street),
        ]
    })))

    msg.append(.array(sortMessagePackArray(arr: contact.urlAddresses.map{
        [
            stringOrNull(str: $0.label),
            .string(String($0.value))
        ]
    })))
    
    msg.append(.array(sortMessagePackArray(arr: contact.contactRelations.map{
        [
            stringOrNull(str: $0.label),
            .string(String($0.value.name))
        ]
    })))
    
    if contact.imageDataAvailable, let imageData = contact.thumbnailImageData {
        msg.append(.binary(imageData))
    } else {
        msg.append(nil)
    }
    
    msg.append(.string(contact.note))
    
    let sha = Sha256()
    
    sha.update(data: pack(.array(msg)))
    
    return versionHash(hash: sha.finalize())
}
