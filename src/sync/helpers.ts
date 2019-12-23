import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import * as ICAL from 'ical.js';
import sjcl from 'sjcl';

import { PRODID, ContactType, EventType, TaskType, TaskStatusType, timezoneLoadFromName } from '../pim-types';

import { logger } from '../logging';
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
    sha.update(entry[key].toString());
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
  const rrule = event.component.getFirstPropertyValue<ICAL.Recur>('rrule');
  if (!rrule) {
    return undefined;
  }

  const frequency = rrule.freq && Calendar.Frequency[rrule.freq];
  if (!frequency) {
    return undefined;
  }
  let daysOfTheWeek;
  if (rrule.byday) {
    daysOfTheWeek = rrule.byday.map((x) => {
      const weekNo = x.slice(0, -2);
      const day = x.slice(-2);
      return {
        dayOfTheWeek: ICAL.Recur[day],
        weekNumber: (weekNo) ? parseInt(weekNo) : undefined,
      };
    });
  }
  const ret: Calendar.RecurrenceRule = {
    frequency,
    interval: rrule.interval || undefined,
    endDate: timeVobjectToNative(rrule.until)?.toISOString(),
    occurrence: rrule.count || undefined,
    daysOfTheWeek,
    daysOfTheMonth: rrule.bymonthday,
    daysOfTheYear: rrule.byyearday,
    weeksOfTheYear: rrule.byweekno,
    monthsOfTheYear: rrule.bymonth,
    setPositions: rrule.bysetpos,
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
    endDate.adjust(0, 0, -1, 0); // Expo requires the end date to be on the end day
    endDate.isDate = true;
  }

  let timeZone = event.timezone ?? undefined;
  if (event.timezone && !timezoneLoadFromName(event.timezone)) {
    timeZone = undefined;
    logger.warn(`Ignoring invalid timezone: ${event.timezone}`);
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
    timeZone,
  };

  return ret;
}

export function taskVobjectToNative(task: TaskType) {
  let timeZone = task.timezone ?? undefined;
  if (task.timezone && !timezoneLoadFromName(task.timezone)) {
    timeZone = undefined;
    logger.warn(`Ignoring invalid timezone: ${task.timezone}`);
  }

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
    timeZone,
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

function rruleNativeToVobject(rrule: Calendar.RecurrenceRule, allDay: boolean) {
  const value: ICAL.RecurData = {
    freq: rrule.frequency.toUpperCase() as ICAL.FrequencyValues,
    interval: rrule.interval || 1,
  };

  if (rrule.endDate) {
    value.until = timeNativeToVobject(new Date(rrule.endDate), allDay);
  }
  if (rrule.occurrence) {
    value.count = rrule.occurrence;
  }
  if (rrule.daysOfTheWeek) {
    value.byday = rrule.daysOfTheWeek.map((x) => {
      let weekNo = '';
      if (x.weekNumber) {
        weekNo = `${(x.weekNumber > 0) ? '+' : '-'}${Math.abs(x.weekNumber)}`;
      }
      return weekNo + ICAL.WeekDay[x.dayOfTheWeek];
    });
  }
  if (rrule.daysOfTheMonth) {
    value.bymonthday = rrule.daysOfTheMonth;
  }
  if (rrule.daysOfTheYear) {
    value.byyearday = rrule.daysOfTheYear;
  }
  if (rrule.weeksOfTheYear) {
    value.byweekno = rrule.weeksOfTheYear;
  }
  if (rrule.monthsOfTheYear) {
    value.bymonth = rrule.monthsOfTheYear;
  }
  if (rrule.setPositions) {
    value.bysetpos = rrule.setPositions;
  }

  return new ICAL.Recur(value);
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
    const value = rruleNativeToVobject(task.recurrenceRule, false);
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
    const value = rruleNativeToVobject(event.recurrenceRule, event.allDay);
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
    const subType = prop.toJSON()[1].type;
    return mapper((typeof subType === 'object') ? subType[0] : subType, prop.getFirstValue());
  }).filter(isDefined);
}

export function contactVobjectToNative(contact: ContactType) {
  const phoneNumbers: Contacts.PhoneNumber[] = contactFieldToNative<Contacts.PhoneNumber>(contact, 'tel', (fieldType: string, value: string) => {
    return {
      id: value,
      number: value,
      isPrimary: false,
      label: fieldType,
    };
  });

  const emails: Contacts.Email[] = contactFieldToNative<Contacts.Email>(contact, 'email', (fieldType: string, value: string) => {
    return {
      email: value,
      id: value,
      isPrimary: false,
      label: fieldType,
    };
  });

  const instantMessageAddresses = contactFieldToNative<Contacts.InstantMessageAddress>(contact, 'impp', (fieldType: string, value: string) => {
    return {
      username: value,
      id: value,
      label: fieldType,
      service: fieldType,
    };
  });

  const urlAddresses = contactFieldToNative<Contacts.UrlAddress>(contact, 'url', (fieldType: string, value: string) => {
    return {
      url: value,
      id: value,
      label: fieldType,
    };
  });

  const addresses = contactFieldToNative<Contacts.Address>(contact, 'adr', (fieldType: string, value: string | string[]) => {
    if (typeof value === 'string') {
      value = value.split(';');
    }
    return {
      id: fieldType,
      label: fieldType,
      poBox: value[0],
      street: value[2],
      city: value[3],
      region: value[4],
      postalCode: value[5],
      country: value[6],
    };
  });

  function parseDate(prop: ICAL.Property) {
    const value = prop.getFirstValue();
    if (value.day !== null) {
      return {
        day: value.day,
        month: value.month,
        year: value.year,
      };
    } else {
      const time = prop.toJSON()[3];
      if (time.length === 6 && time.startsWith('--')) {
        return {
          day: parseInt(time.slice(4, 6)),
          month: parseInt(time.slice(2, 4)),
          year: null,
        };
      }
    }

    return {};
  }

  const birthdays: Contacts.Date[] = contact.comp.getAllProperties('bday').map((prop) => {
    const value = parseDate(prop);

    return {
      id: 'bday',
      day: value.day,
      month: value.month,
      year: value.year,
      format: Contacts.CalendarFormats.Gregorian,
      label: 'Birthday',
    };
  });

  const dates: Contacts.Date[] = contact.comp.getAllProperties('anniversary').map((prop) => {
    const value = parseDate(prop);

    return {
      id: 'anniversary',
      day: value.day,
      month: value.month,
      year: value.year,
      format: Contacts.CalendarFormats.Gregorian,
      label: 'Anniversary',
    };
  });

  const titles: string[] = contactFieldToNative<string>(contact, 'title', (_fieldType: string, value: string) => {
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
    birthday: birthdays.length > 0 ? birthdays[0] : undefined,
    dates,
    contactType: contact.group ? Contacts.ContactTypes.Company : Contacts.ContactTypes.Person,
    phoneNumbers,
    emails,
    addresses,
    instantMessageAddresses,
    urlAddresses,
  };

  const nField = contact.comp.getFirstProperty('n');
  if (nField) {
    let nFieldParts = nField.getFirstValue();
    if (typeof nFieldParts === 'string') {
      nFieldParts = nFieldParts.split(';');
    }
    ret.lastName = nFieldParts[0];
    ret.firstName = nFieldParts[1];
    ret.middleName = nFieldParts[2];
    ret.namePrefix = nFieldParts[3];
    ret.nameSuffix = nFieldParts[4];
  } else if (ret.name) {
    // Do our best deconstructing fn
    ret.firstName = ret.name;
  }

  const orgField = contact.comp.getFirstProperty('org');
  if (orgField) {
    let orgFieldParts = orgField.getFirstValue();
    if (typeof orgFieldParts === 'string') {
      orgFieldParts = orgFieldParts.split(';');
    }
    ret.company = orgFieldParts[0];
    ret.department = orgFieldParts[1];
  }

  return ret;
}

function addProperty(comp: ICAL.Component, fieldName: string, subType: string | null, value: string | string[]) {
  const prop = new ICAL.Property(fieldName, comp);
  if (subType) {
    prop.setParameter('type', subType);
  }
  if (typeof value === 'string') {
    prop.setValue(value);
  } else {
    prop.setValues(value);
  }
  comp.addProperty(prop);
}

export function contactNativeToVobject(contact: NativeContact): ContactType {
  const ret = new ContactType(new ICAL.Component(['vcard', [], []]));

  const comp = ret.comp;
  comp.updatePropertyWithValue('prodid', PRODID);
  comp.updatePropertyWithValue('version', '4.0');
  comp.updatePropertyWithValue('uid', contact.uid ?? contact.id);
  comp.updatePropertyWithValue('rev', ICAL.Time.now());
  if (contact.name) {
    comp.updatePropertyWithValue('fn', contact.name);
  }
  const name = [contact.lastName, contact.firstName, contact.middleName, contact.namePrefix, contact.nameSuffix];
  if (name.some((x) => !!x)) {
    addProperty(comp, 'n', null, name.map((x) => x ?? ''));
  }
  if (contact.nickname) {
    comp.updatePropertyWithValue('nickname', contact.nickname);
  }
  if (contact.phoneNumbers) {
    for (const phoneNumber of contact.phoneNumbers) {
      addProperty(comp, 'tel', phoneNumber.label, phoneNumber.number!);
    }
  }
  if (contact.emails) {
    for (const email of contact.emails) {
      addProperty(comp, 'email', email.label, email.email!);
    }
  }
  if (contact.instantMessageAddresses) {
    for (const impp of contact.instantMessageAddresses) {
      addProperty(comp, 'impp', impp.label, impp.username!);
    }
  }
  if (contact.urlAddresses) {
    for (const url of contact.urlAddresses) {
      if (url.url) {
        addProperty(comp, 'url', url.label, url.url);
      }
    }
  }
  function formatDate(date: NonNullable<typeof contact.birthday>) {
    let formattedDate = '';
    formattedDate += (date.year) ? date.year.toString().padStart(2, '0') : '--';
    if (date.month) {
      formattedDate += date.month.toString().padStart(2, '0');
    }
    if (date.day) {
      formattedDate += date.day.toString().padStart(2, '0');
    }
    return formattedDate;
  }
  if (contact.dates) {
    for (const date of contact.dates) {
      comp.updatePropertyWithValue('anniversary', formatDate(date));
    }
  }
  if (contact.birthday) {
    comp.updatePropertyWithValue('bday', formatDate(contact.birthday));
  }

  if (contact.addresses) {
    for (const address of contact.addresses) {
      const adr = [address.poBox, '', address.street, address.city, address.region, address.postalCode, address.country];
      if (adr.some((x) => !!x)) {
        addProperty(comp, 'adr', address.label, adr.map((x) => x?.replace(';', ',') ?? '').join(';'));
      }
    }
  }
  if (contact.jobTitle) {
    comp.updatePropertyWithValue('title', contact.jobTitle);
  }
  const org = [contact.company, contact.department, ''];
  if (org.some((x) => !!x)) {
    addProperty(comp, 'org', null, org.map((x) => x?.replace(';', ',') ?? '').join(';'));
  }

  if (contact.note) {
    comp.updatePropertyWithValue('note', contact.note);
  }

  return ret;
}
