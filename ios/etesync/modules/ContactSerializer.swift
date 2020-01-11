//
//  ContactSerializer.swift
//  etesync
//
//  Created by Me Me on 01/01/2020.
//  Copyright © 2020 650 Industries, Inc. All rights reserved.
//

import Foundation
import Contacts

private let EXContactsKeyId = "id";
private let EXContactsKeyContactType = "contactType";
private let EXContactsKeyAddresses = "addresses";
private let EXContactsKeyPhoneNumbers = "phoneNumbers";
private let EXContactsKeyEmails = "emails";
private let EXContactsKeyFirstName = "firstName";
private let EXContactsKeyMiddleName = "middleName";
private let EXContactsKeyLastName = "lastName";
private let EXContactsKeyNamePrefix = "namePrefix";
private let EXContactsKeyNameSuffix = "nameSuffix";
private let EXContactsKeyNickname = "nickname";
private let EXContactsKeyPhoneticFirstName = "phoneticFirstName";
private let EXContactsKeyPhoneticMiddleName = "phoneticMiddleName";
private let EXContactsKeyPhoneticLastName = "phoneticLastName";
private let EXContactsKeyMaidenName = "maidenName";
private let EXContactsKeyBirthday = "birthday";
private let EXContactsKeyNonGregorianBirthday = "nonGregorianBirthday";
private let EXContactsKeyImageAvailable = "imageAvailable";
private let EXContactsKeyRawImage = "rawImage";
private let EXContactsKeyImage = "image";
private let EXContactsKeyNote = "note";
private let EXContactsKeyCompany = "company";
private let EXContactsKeyJobTitle = "jobTitle";
private let EXContactsKeyDepartment = "department";
private let EXContactsKeySocialProfiles = "socialProfiles";
private let EXContactsKeyInstantMessageAddresses = "instantMessageAddresses";
private let EXContactsKeyUrlAddresses = "urlAddresses";
private let EXContactsKeyDates = "dates";
private let EXContactsKeyRelationships = "relationships";
private let EXContactsKeyName = "name";
private let EXContactsKeyEditor = "editor";
private let EXContactsKeyRawImageBase64 = "rawImageBase64";
private let EXContactsKeyImageBase64 = "imageBase64";

func decodeDate(data: Dictionary<String, Any>?) -> DateComponents? {
    guard let date = data else {
        return nil
    }
    var ret = DateComponents()
    if let day = date["day"] as? Int {
        ret.day = day
    }
    if let month = date["month"] as? Int {
        ret.month = month + 1
    }
    if let year = date["year"] as? Int {
        ret.year = year
    }
    
    return ret
}

func mutateContact(contact: CNMutableContact, data: Dictionary<String, Any>) {
    contact.givenName = data[EXContactsKeyFirstName] as! String? ?? ""
    contact.familyName = data[EXContactsKeyLastName] as! String? ?? ""
    contact.middleName = data[EXContactsKeyMiddleName] as! String? ?? ""
    contact.previousFamilyName = data[EXContactsKeyMaidenName] as! String? ?? ""
    contact.nickname = data[EXContactsKeyNickname] as! String? ?? ""
    contact.organizationName = data[EXContactsKeyCompany] as! String? ?? ""
    contact.jobTitle = data[EXContactsKeyJobTitle] as! String? ?? ""
    contact.departmentName = data[EXContactsKeyDepartment] as! String? ?? ""
    contact.namePrefix = data[EXContactsKeyNamePrefix] as! String? ?? ""
    contact.nameSuffix = data[EXContactsKeyNameSuffix] as! String? ?? ""
    // contact.phoneticGivenName = data[EXContactsKeyPhoneticFirstName] as! String? ?? ""
    // contact.phoneticMiddleName = data[EXContactsKeyPhoneticMiddleName] as! String? ?? ""
    // contact.phoneticFamilyName = data[EXContactsKeyPhoneticLastName] as! String? ?? ""
    // contact.note = data[EXContactsKeyNote] as! String? ?? ""
    contact.birthday = decodeDate(data: data[EXContactsKeyBirthday] as! Dictionary<String, Any>?)

    if let phoneNumebrs = data[EXContactsKeyPhoneNumbers] {
        contact.phoneNumbers = EXContacts.decodePhoneNumbers(phoneNumebrs as? [Any]) as! [CNLabeledValue<CNPhoneNumber>]
    } else {
        contact.phoneNumbers = []
    }
    
    if let postalAddresses = data[EXContactsKeyAddresses] {
        contact.postalAddresses = EXContacts.decodeAddresses(postalAddresses as? [Any]) as! [CNLabeledValue<CNPostalAddress>]
    } else {
        contact.postalAddresses = []
    }
    
    if let emailAddresses = data[EXContactsKeyEmails] {
        contact.emailAddresses = EXContacts.decodeEmailAddresses(emailAddresses as? [Any]) as! [CNLabeledValue<NSString>]
    } else {
        contact.emailAddresses = []
    }
    
    if let instantMessageAddresses = data[EXContactsKeyInstantMessageAddresses] {
        contact.instantMessageAddresses = EXContacts.decodeInstantMessageAddresses(instantMessageAddresses as? [Any]) as! [CNLabeledValue<CNInstantMessageAddress>]
    } else {
        contact.instantMessageAddresses = []
    }
    
    if let urlAddresses = data[EXContactsKeyUrlAddresses] {
        contact.urlAddresses = EXContacts.decodeUrlAddresses(urlAddresses as? [Any]) as! [CNLabeledValue<NSString>]
    } else {
        contact.urlAddresses = []
    }
    
    if let dates = data[EXContactsKeyDates] {
        contact.dates = EXContacts.decodeDates(dates as? [Any]) as! [CNLabeledValue<NSDateComponents>]
    } else {
        contact.dates = []
    }
    
    if let relationships = data[EXContactsKeyRelationships] {
        contact.contactRelations = EXContacts.decodeRelationships(relationships as? [Any]) as! [CNLabeledValue<CNContactRelation>]
    } else {
        contact.contactRelations = []
    }
    
    if let image = data[EXContactsKeyImage] as! Dictionary<String, String>? {
        let base64 = image["base64"]
        contact.imageData = (base64 != nil) ? Data(base64Encoded: base64!) : nil
    } else {
        contact.imageData = nil
    }
}
