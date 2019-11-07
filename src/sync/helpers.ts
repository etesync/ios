import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import * as ICAL from 'ical.js';
import sjcl from 'sjcl';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { ContactType, EventType, TaskType, TaskStatusType, timezoneLoadFromName } from '../pim-types';

import { isDefined } from '../helpers';

export interface NativeBase {
  id?: string; // This is the local ID of the item (on the device)
  uid: string; // This is the EteSync UUID for the item
}

export interface NativeEvent extends Omit<Calendar.Event, 'id'>, NativeBase {
}

export interface NativeTask extends Calendar.Reminder, NativeBase {
}

export interface NativeContact extends Omit<Contacts.Contact, 'id'>, NativeBase {
}

export function entryNativeHashCalc(entry: {uid: string}) {
  const ignoreKeys = ['lastModifiedDate'];
  const sha = new sjcl.hash.sha256();
  Object.keys(entry).sort().forEach((key) => {
    if (!entry[key] || ignoreKeys.includes(key)) {
      return;
    }
    sha.update(key);
    sha.update(entry[key]);
  });
  return sjcl.codec.hex.fromBits(sha.finalize());
}

function timeVobjectToNative(time: ICAL.Time | undefined) {
  if (!time) {
    return undefined;
  }

  if (time.isDate) {
    const ret = new Date(0);
    ret.setUTCFullYear(time.year);
    ret.setUTCMonth(time.month - 1);
    ret.setUTCDate(time.day);
    ret.setUTCHours(time.hour);
    ret.setUTCMinutes(time.minute);
    return ret;
  } else {
    return time.toJSDate();
  }
}

function alarmVobjectToNative(alarm: ICAL.Component) {
  const trigger = alarm.getFirstPropertyValue('trigger');

  if (!('isNegative' in trigger)) {
    // FIXME: we only handle relative alarms at the moment (should have isNegative)
    return undefined;
  }

  const relativeOffset =
    ((trigger.isNegative) ? -1 : 1) *
    (
      (((trigger.days * 24) + trigger.hours) * 60) +
      trigger.minutes
    );

  const ret: Calendar.Alarm = {
    relativeOffset,
  };

  return ret;
}

function rruleVobjectToNative(event: EventType) {
  const rrule = event.component.getFirstPropertyValue('rrule');
  if (!rrule) {
    return undefined;
  }

  const frequency = Calendar.Frequency[rrule.freq];
  if (!frequency) {
    return undefined;
  }

  const ret: Calendar.RecurrenceRule = {
    frequency,
    interval: rrule.interval || undefined,
    endDate: rrule.until || undefined,
    occurrence: rrule.count || undefined,
  };

  return ret;
}

export function eventVobjectToNative(event: EventType) {
  const allDay = event.startDate.isDate;
  const endDate = event.endDate.clone();

  if (allDay) {
    endDate.isDate = false;
    if (event.startDate.compare(endDate) === 0) {
      endDate.adjust(1, 0, 0, 0); // If the event has the same start and end date, correct the date range.
    }
    endDate.adjust(-1, 0, 1, 0); // Needed due to iOS/Expo issues
  }

  const ret: Partial<NativeEvent> & NativeBase = {
    uid: event.uid,
    title: event.title ?? '',
    allDay,
    startDate: timeVobjectToNative(event.startDate),
    endDate: timeVobjectToNative(endDate),
    location: event.location ?? '',
    notes: event.description ?? '',
    alarms: event.component.getAllSubcomponents('valarm').map(alarmVobjectToNative).filter(isDefined),
    recurrenceRule: rruleVobjectToNative(event),
    timeZone: event.timezone ?? '',
  };

  return ret;
}

export function taskVobjectToNative(task: TaskType) {
  const ret: NativeTask = {
    uid: task.uid,
    title: task.title ?? '',
    startDate: timeVobjectToNative(task.startDate),
    dueDate: timeVobjectToNative(task.dueDate),
    completed: task.finished,
    completionDate: timeVobjectToNative(task.completionDate),
    location: task.location ?? '',
    notes: task.description ?? '',
    alarms: task.component.getAllSubcomponents('valarm').map(alarmVobjectToNative).filter(isDefined),
    recurrenceRule: rruleVobjectToNative(task),
    timeZone: task.timezone ?? '',
  };

  return ret;
}



function timeNativeToVobject(date: Date, allDay: boolean) {
  const ret = ICAL.Time.fromJSDate(date, true);
  if (!allDay) {
    return ret;
  } else {
    // Adding almost a day and then making it allDay acorrectly handles allDay adjustments.
    ret.adjust(0, 23, 59, 0);
    const data = ret.toJSON();
    data.isDate = allDay;
    return ICAL.Time.fromData(data);
  }
}

function alarmNativeToVobject(alarm: Calendar.Alarm, description: string) {
  if (alarm.relativeOffset === undefined) {
    // FIXME: we only support relative alarms at the moment
    return undefined;
  }

  const alarmComponent = new ICAL.Component(['valarm', [], []]);
  alarmComponent.addPropertyWithValue('action', 'DISPLAY');
  alarmComponent.addPropertyWithValue('description', description);
  const trigger = ((alarm.relativeOffset < 0) ? '-' : '') + `PT${Math.abs(alarm.relativeOffset)}M`;
  alarmComponent.addPropertyWithValue('trigger', trigger);

  return alarmComponent;
}

function rruleNativeToVobject(rrule: Calendar.RecurrenceRule) {
  const value: ICAL.Recur = {
    freq: rrule.frequency.toUpperCase() as ICAL.FrequencyValues,
    interval: rrule.interval || 1,
  };

  if (rrule.endDate) {
    value.until = ICAL.Time.fromString(rrule.endDate);
  }
  if (rrule.occurrence) {
    value.count = rrule.occurrence;
  }

  return value;
}

export function taskNativeToVobject(task: NativeTask): TaskType {
  const ret = new TaskType();
  ret.uid = task.uid;
  ret.summary = task.title ?? '';
  if (task.startDate) {
    ret.startDate = timeNativeToVobject(new Date(task.startDate), false);
  }
  if (task.dueDate) {
    ret.dueDate = timeNativeToVobject(new Date(task.dueDate), false);
  }
  if (task.completionDate) {
    ret.completionDate = timeNativeToVobject(new Date(task.completionDate), false);
  }
  ret.status = (task.completed) ? TaskStatusType.Completed : TaskStatusType.InProcess;
  if (task.location) {
    ret.location = task.location;
  }
  if (task.notes) {
    ret.description = task.notes;
  }
  if (task.alarms) {
    task.alarms.forEach((alarm) => {
      const alarmComponent = alarmNativeToVobject(alarm, ret.summary);
      if (alarmComponent) {
        ret.component.addSubcomponent(alarmComponent);
      }
    });
  }

  if (task.recurrenceRule) {
    const value = rruleNativeToVobject(task.recurrenceRule);
    ret.component.addPropertyWithValue('rrule', value);
  }

  if (task.timeZone) {
    const timezone = timezoneLoadFromName(task.timeZone);
    if (timezone) {
      ret.startDate = ret.startDate?.convertToZone(timezone);
      ret.dueDate = ret.dueDate?.convertToZone(timezone);
      ret.completionDate = ret.completionDate?.convertToZone(timezone);
    }
  }

  return ret;
}

export function eventNativeToVobject(event: NativeEvent): EventType {
  const startDate = timeNativeToVobject(new Date(event.startDate), event.allDay);
  const endDate = timeNativeToVobject(new Date(event.endDate), event.allDay);

  const ret = new EventType();
  ret.uid = event.uid;
  ret.summary = event.title ?? '';
  ret.startDate = startDate;
  ret.endDate = endDate;
  if (event.location) {
    ret.location = event.location;
  }
  if (event.notes) {
    ret.description = event.notes;
  }
  if (event.alarms) {
    event.alarms.forEach((alarm) => {
      const alarmComponent = alarmNativeToVobject(alarm, ret.summary);
      if (alarmComponent) {
        ret.component.addSubcomponent(alarmComponent);
      }
    });
  }

  if (event.recurrenceRule) {
    const value = rruleNativeToVobject(event.recurrenceRule);
    ret.component.addPropertyWithValue('rrule', value);
  }

  if (event.timeZone) {
    const timezone = timezoneLoadFromName(event.timeZone);
    if (timezone) {
      ret.startDate = ret.startDate.convertToZone(timezone);
      ret.endDate = ret.endDate.convertToZone(timezone);
    }
  }

  return ret;
}

function contactFieldToNative<T>(contact: ContactType, fieldName: string, mapper: (fieldType: string, value: any) => T | undefined) {
  return contact.comp.getAllProperties(fieldName).map((prop) => {
    return mapper(prop.toJSON()[1].type, prop.getFirstValue());
  }).filter(isDefined);
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

  const birthdays: Contacts.Date[] = contactFieldToNative<Contacts.Date>(contact, 'bday', (_fieldType: string, value: ICAL.Time) => {
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

  const notes: string[] = contactFieldToNative<string>(contact, 'note', (_fieldType: string, value: string) => {
    return value;
  });

  const titles: string[] = contactFieldToNative<string>(contact, 'note', (_fieldType: string, value: string) => {
    return value;
  });
  const jobTitle = titles.length > 0 ? titles[0] : undefined;

  const nickname = contact.comp.getFirstPropertyValue('nickname') ?? undefined;

  const ret: NativeContact & Contacts.Contact = {
    id: '',
    uid: contact.uid,
    name: contact.fn,
    nickname,
    jobTitle,
    note: notes.length > 0 ? notes.join('\n') : undefined,
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

  const orgField = contact.comp.getFirstProperty('org');
  if (orgField) {
    const orgFieldParts = orgField.getValues()[0];
    ret.company = orgFieldParts[0];
    ret.department = `${orgFieldParts[1]} ${orgFieldParts[2]}`;
  }

  return ret;
}
