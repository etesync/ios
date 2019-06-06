import { Calendar, Contacts } from 'expo';
import * as ICAL from 'ical.js';

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

export function contactVobjectToNative(contact: ContactType) {
  const ret: NativeContact = {
    id: '',
    uid: contact.uid,
    name: contact.fn,
    contactType: contact.group ? Contacts.ContactTypes.Company : Contacts.ContactTypes.Person,
  };

  return ret;
}
