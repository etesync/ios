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
    if let day = date["day"] as! String? {
        ret.day = Int(day)
    }
    if let month = date["month"] as! String? {
        ret.month = Int(month)! + 1
    }
    if let year = date["year"] as! String? {
        ret.year = Int(year)
    }
    
    return ret
}

func mutateContact(contact: CNMutableContact, data: Dictionary<String, Any>) {
    if let givenName = data[EXContactsKeyFirstName] as! String? {
        contact.givenName = givenName
    }
    if let familyName = data[EXContactsKeyLastName] as! String? {
        contact.familyName = familyName
    }
    if let middleName = data[EXContactsKeyMiddleName] as! String? {
        contact.middleName = middleName
    }
    if let previousFamilyName = data[EXContactsKeyMaidenName] as! String? {
        contact.previousFamilyName = previousFamilyName
    }
    if let nickname = data[EXContactsKeyNickname] as! String? {
        contact.nickname = nickname
    }
    if let organizationName = data[EXContactsKeyCompany] as! String? {
        contact.organizationName = organizationName
    }
    if let jobTitle = data[EXContactsKeyJobTitle] as! String? {
        contact.jobTitle = jobTitle
    }
    if let departmentName = data[EXContactsKeyDepartment] as! String? {
        contact.departmentName = departmentName
    }
    if let namePrefix = data[EXContactsKeyNamePrefix] as! String? {
        contact.namePrefix = namePrefix
    }
    if let nameSuffix = data[EXContactsKeyNameSuffix] as! String? {
        contact.nameSuffix = nameSuffix
    }
    if let phoneticGivenName = data[EXContactsKeyPhoneticFirstName] as! String? {
        contact.phoneticGivenName = phoneticGivenName
    }
    if let phoneticMiddleName = data[EXContactsKeyPhoneticMiddleName] as! String? {
        contact.phoneticMiddleName = phoneticMiddleName
    }
    if let phoneticFamilyName = data[EXContactsKeyPhoneticLastName] as! String? {
        contact.phoneticFamilyName = phoneticFamilyName
    }
    if let note = data[EXContactsKeyNote] as! String? {
        contact.note = note
    }
    if let birthday = decodeDate(data: data[EXContactsKeyBirthday] as! Dictionary<String, Any>?) {
        contact.birthday = birthday
    }
    
    if let phoneNumebrs = data[EXContactsKeyPhoneNumbers] as! Array<Dictionary<String, String>>? {
        contact.phoneNumbers = phoneNumebrs.map{
            let label = $0["label"]
            let number = $0["number"]!
            return CNLabeledValue(label: label, value: CNPhoneNumber(stringValue: number))
        }
    }
    
    if let postalAddresses = data[EXContactsKeyAddresses] as! Array<Dictionary<String, String>>? {
        contact.postalAddresses = postalAddresses.map{
            let label = $0["label"]
            let value = CNMutablePostalAddress()
            value.street = $0["street"] ?? ""
            value.postalCode = $0["postalCode"] ?? ""
            value.city = $0["city"] ?? ""
            value.country = $0["country"] ?? ""
            value.state = $0["region"] ?? ""
            value.isoCountryCode = $0["isoCountryCode"] ?? ""
            return CNLabeledValue(label: label, value: value)
        }
    }
    
    if let emailAddresses = data[EXContactsKeyEmails] as! Array<Dictionary<String, String>>? {
        contact.emailAddresses = emailAddresses.map{
            let label = $0["label"]
            let value = $0["email"]!
            return CNLabeledValue(label: label, value: value as NSString)
        }
    }
    
    if let instantMessageAddresses = data[EXContactsKeyInstantMessageAddresses] as! Array<Dictionary<String, String>>? {
        contact.instantMessageAddresses = EXContacts.decodeInstantMessageAddresses(instantMessageAddresses) as! [CNLabeledValue<CNInstantMessageAddress>]
    }
    
    if let urlAddresses = data[EXContactsKeyUrlAddresses] as! Array<Dictionary<String, String>>? {
        contact.urlAddresses = EXContacts.decodeUrlAddresses(urlAddresses) as! [CNLabeledValue<NSString>]
    }
    
    if let dates = data[EXContactsKeyDates] as! Array<Dictionary<String, String>>? {
        contact.dates = EXContacts.decodeDates(dates) as! [CNLabeledValue<NSDateComponents>]
    }
    
    if let relationships = data[EXContactsKeyRelationships] as! Array<Dictionary<String, String>>? {
        contact.contactRelations = EXContacts.decodeRelationships(relationships) as! [CNLabeledValue<CNContactRelation>]
    }
    
    if let image = data[EXContactsKeyImage] as! Dictionary<String, String>? {
        let base64 = image["base64"]
        contact.imageData = (base64 != nil) ? Data(base64Encoded: base64!) : nil
    }
}
