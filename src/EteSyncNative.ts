// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { NativeModules } from 'react-native';
import * as Contacts from 'expo-contacts';
import { NativeContact, NativeEvent, NativeTask } from './sync/helpers';

export type HashesForItem = [string, string, string | undefined];

export type HashDictionary = { [key: string]: HashesForItem };

export enum BatchAction {
  Add = 1,
  Change = 2,
  Delete = 3
}

interface EteSyncNativeModule {
  hashEvent(eventId: string): Promise<string>;
  calculateHashesForEvents(calendarId: string, from: number, to: number): Promise<HashesForItem[]>;
  processEventsChanges(containerId: string, events: ([BatchAction, NativeEvent])[]): Promise<HashDictionary>;
  hashReminder(eventId: string): Promise<string>;
  calculateHashesForReminders(calendarId: string): Promise<HashesForItem[]>;
  processRemindersChanges(containerId: string, reminders: ([BatchAction, NativeTask])[]): Promise<HashDictionary>;
  hashContact(contactId: string): Promise<string>;
  calculateHashesForContacts(containerId: string): Promise<HashesForItem[]>;
  deleteContactGroupAndMembers(groupId: string): Promise<number>;
  getContainers(): Promise<(Contacts.Container & { default: boolean })[]>;
  processContactsChanges(containerId: string, groupId: string | null, contacts: ([BatchAction, NativeContact])[]): Promise<HashDictionary>;

  beginBackgroundTask(name: string): Promise<number>;
  endBackgroundTask(taskId: number): void;

  playground(param: {}): void;
}

const EteSyncNative = NativeModules.EteSyncNative as EteSyncNativeModule;

export function calculateHashesForEvents(calendarId: string, from: Date, to: Date): Promise<HashesForItem[]> {
  return EteSyncNative.calculateHashesForEvents(calendarId, from.getTime() / 1000, to.getTime() / 1000);
}

export const hashEvent = EteSyncNative.hashEvent;

export function calculateHashesForReminders(calendarId: string): Promise<HashesForItem[]> {
  return EteSyncNative.calculateHashesForReminders(calendarId);
}
export const processEventsChanges = EteSyncNative.processEventsChanges;

export const hashReminder = EteSyncNative.hashReminder;

export function calculateHashesForContacts(containerId: string): Promise<HashesForItem[]> {
  return EteSyncNative.calculateHashesForContacts(containerId);
}
export const processRemindersChanges = EteSyncNative.processRemindersChanges;

export const hashContact = EteSyncNative.hashContact;
export const deleteContactGroupAndMembers = EteSyncNative.deleteContactGroupAndMembers;
export const getContainers = EteSyncNative.getContainers;
export const processContactsChanges = EteSyncNative.processContactsChanges;

export const { beginBackgroundTask, endBackgroundTask } = EteSyncNative;


export const playground = EteSyncNative.playground;
