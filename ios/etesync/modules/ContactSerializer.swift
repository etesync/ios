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
    contact.phoneticGivenName = data[EXContactsKeyPhoneticFirstName] as! String? ?? ""
    contact.phoneticMiddleName = data[EXContactsKeyPhoneticMiddleName] as! String? ?? ""
    contact.phoneticFamilyName = data[EXContactsKeyPhoneticLastName] as! String? ?? ""
    contact.note = data[EXContactsKeyNote] as! String? ?? ""
    contact.birthday = decodeDate(data: data[EXContactsKeyBirthday] as! Dictionary<String, Any>?)
    
    if let phoneNumebrs = data[EXContactsKeyPhoneNumbers] as! Array<Dictionary<String, String>>? {
        contact.phoneNumbers = phoneNumebrs.map{
            let label = $0["label"]
            let number = $0["number"]!
            return CNLabeledValue(label: label, value: CNPhoneNumber(stringValue: number))
        }
    } else {
        contact.phoneNumbers = []
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
    } else {
        contact.postalAddresses = []
    }
    
    if let emailAddresses = data[EXContactsKeyEmails] as! Array<Dictionary<String, String>>? {
        contact.emailAddresses = emailAddresses.map{
            let label = $0["label"]
            let value = $0["email"]!
            return CNLabeledValue(label: label, value: value as NSString)
        }
    } else {
        contact.emailAddresses = []
    }
    
    /*
    NSMutableArray *instantMessageAddresses = [EXContacts decodeInstantMessageAddresses:data[EXContactsKeyInstantMessageAddresses]];
    if (instantMessageAddresses) contact.instantMessageAddresses = instantMessageAddresses;
    
    NSMutableArray *urlAddresses = [EXContacts decodeUrlAddresses:data[EXContactsKeyUrlAddresses]];
    if (urlAddresses) contact.urlAddresses = urlAddresses;
    
    NSMutableArray *dates = [EXContacts decodeDates:data[EXContactsKeyDates]];
    if (dates) contact.dates = dates;
    
    NSMutableArray *relationships = [EXContacts decodeRelationships:data[EXContactsKeyRelationships]];
    if (relationships) contact.contactRelations = relationships;
    
    if (data[EXContactsKeyImage]) {
        NSData *imageData;
        if ([data[EXContactsKeyImage] isKindOfClass:[NSString class]]) {
            imageData = [self _imageDataForPath:data[EXContactsKeyImage] rejecter:reject];
        } else if ([data[EXContactsKeyImage] isKindOfClass:[NSDictionary class]]) {
            imageData = [self _imageDataForPath:data[EXContactsKeyImage][@"uri"] rejecter:reject];
        }
        if (imageData) {
            contact.imageData = imageData;
        }
    }
    */
}
