import { Calendar, Contacts } from 'expo';
import * as ICAL from 'ical.js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { ContactType, EventType } from '../pim-types';

export interface NativeEvent extends Calendar.Event {
  uid: string; // This is the EteSync UUID for the event
}

export interface NativeContact extends Contacts.Contact {
  uid: string; // This is the EteSync UUID for the contact
}

export function eventVobjectToNative(event: EventType) {
  const allDay = event.startDate.isDate;
  let endDate = event.endDate.clone();

  if (allDay) {
    endDate.adjust(-1, 0, 0, 0);
    // FIXME: why is it even needed?
    if (event.startDate.compare(endDate) > 0) {
      endDate = event.startDate.clone();
    }
  }

  const ret: NativeEvent = {
    uid: event.uid,
    title: event.title || '',
    allDay,
    startDate: event.startDate.toJSDate(),
    endDate: endDate.toJSDate(),
    location: event.location || '',
    notes: event.description || '',
  };

  return ret;
}


function fromDate(date: Date, allDay: boolean) {
  const ret = ICAL.Time.fromJSDate(date, false);
  if (!allDay) {
    return ret;
  } else {
    const data = ret.toJSON();
    data.isDate = allDay;
    return ICAL.Time.fromData(data);
  }
}

export function eventNativeToVobject(event: NativeEvent) {
  const startDate = fromDate(new Date(event.startDate), event.allDay);
  const endDate = fromDate(new Date(event.endDate), event.allDay);

  if (event.allDay) {
    endDate.adjust(1, 0, 0, 0);
  }

  const ret = new EventType();
  ret.uid = this.state.uid;
  ret.summary = this.state.title;
  ret.startDate = startDate;
  ret.endDate = endDate;
  ret.location = this.state.location;
  ret.description = this.state.description;

  return ret;
}

function contactFieldToNative<T>(contact: ContactType, fieldName: string, mapper: (fieldType: string, value: any) => T) {
  return contact.comp.getAllProperties(fieldName).map((prop) => {
    return mapper(prop.toJSON()[1].type, prop.getFirstValue());
  }).filter((field) => field);
}

export function contactVobjectToNative(contact: ContactType) {
  const phoneNumbers: Contacts.PhoneNumber[] = contactFieldToNative<Contacts.PhoneNumber>(contact, 'tel', (fieldType: string, value: string) => {
    const phoneNumber = parsePhoneNumberFromString(value);
    if (phoneNumber && phoneNumber.isValid()) {
      return {
        id: phoneNumber.formatInternational(),
        number: phoneNumber.formatInternational(),
        digits: phoneNumber.formatNational(),
        countryCode: '+' + phoneNumber.countryCallingCode,
        isPrimary: false,
        label: fieldType,
      };
    } else {
      return undefined;
    }
  });

  const emails: Contacts.Email[] = contactFieldToNative<Contacts.Email>(contact, 'email', (fieldType: string, value: string) => {
    return {
      email: value,
      id: value,
      isPrimary: false,
      label: fieldType,
    };
  });

  const birthdays: Contacts.ContactDate[] = contactFieldToNative<Contacts.ContactDate>(contact, 'bday', (fieldType: string, value: ICAL.Time) => {
    const date = value.toJSDate();
    return {
      id: 'bday',
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      format: Contacts.CalendarFormats.Gregorian,
      label: 'Birthday',
    };
  });

  const nickname = contact.comp.getFirstPropertyValue('nickname') || undefined;

  const ret: NativeContact = {
    id: '',
    uid: contact.uid,
    name: contact.fn,
    nickname,
    birthday: birthdays.length > 0 ? birthdays[0] : undefined,
    contactType: contact.group ? Contacts.ContactTypes.Company : Contacts.ContactTypes.Person,
    phoneNumbers,
    emails,
  };

  const nField = contact.comp.getFirstProperty('n');
  if (nField) {
    const nFieldParts = nField.getValues()[0];
    ret.lastName = nFieldParts[0];
    ret.firstName = nFieldParts[1];
    ret.middleName = nFieldParts[2];
    ret.namePrefix = nFieldParts[3];
    ret.nameSuffix = nFieldParts[4];
  }

  return ret;
}
