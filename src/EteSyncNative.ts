import { NativeModules } from 'react-native';
import * as Contacts from 'expo-contacts';

export type HashesForItem = [string, string];

interface EteSyncNativeModule {
  hashEvent(eventId: string): Promise<string>;
  calculateHashesForEvents(calendarId: string, from: number, to: number): Promise<HashesForItem[]>;
  hashReminder(eventId: string): Promise<string>;
  calculateHashesForReminders(calendarId: string): Promise<HashesForItem[]>;
  hashContact(contactId: string): Promise<string>;
  calculateHashesForContacts(containerId: string): Promise<HashesForItem[]>;
  deleteContactGroupAndMembers(groupId: string): Promise<number>;
  getContainers(): Promise<(Contacts.Container & { default: boolean })[]>;

  beginBackgroundTask(name: string): Promise<number>;
  endBackgroundTask(taskId: number): void;

  playground(): void;
}

const EteSyncNative = NativeModules.EteSyncNative as EteSyncNativeModule;

export function calculateHashesForEvents(calendarId: string, from: Date, to: Date): Promise<HashesForItem[]> {
  return EteSyncNative.calculateHashesForEvents(calendarId, from.getTime() / 1000, to.getTime() / 1000);
}

export const hashEvent = EteSyncNative.hashEvent;

export function calculateHashesForReminders(calendarId: string): Promise<HashesForItem[]> {
  return EteSyncNative.calculateHashesForReminders(calendarId);
}

export const hashReminder = EteSyncNative.hashReminder;

export function calculateHashesForContacts(containerId: string): Promise<HashesForItem[]> {
  return EteSyncNative.calculateHashesForContacts(containerId);
}

export const hashContact = EteSyncNative.hashContact;
export const deleteContactGroupAndMembers = EteSyncNative.deleteContactGroupAndMembers;
export const getContainers = EteSyncNative.getContainers;

export const { beginBackgroundTask, endBackgroundTask } = EteSyncNative;


export const playground = EteSyncNative.playground;
