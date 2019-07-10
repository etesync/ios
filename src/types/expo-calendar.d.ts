// Extra types that are currently not exported (already fixed upstream)

import 'expo-calendar';

declare module 'expo-calendar' {
  type RecurringEventOptions = {
    futureEvents?: boolean;
    instanceStartDate?: string | Date;
  }; // iOS

  type Source = {
    id?: string; // iOS only ??
    type: string;
    name: string;
    isLocalAccount?: boolean; // Android
  };

  type Attendee = {
    id?: string; // Android
    isCurrentUser?: boolean; // iOS
    name: string;
    role: string;
    status: string;
    type: string;
    url?: string; // iOS
    email?: string; // Android
  };

  type Alarm = {
    absoluteDate?: string; // iOS
    relativeOffset?: number;
    structuredLocation?: {
      // iOS
      title?: string;
      proximity?: string; // Proximity
      radius?: number;
      coords?: {
        latitude?: number;
        longitude?: number;
      };
    };
    method?: string; // Method, Android
  };

  type RecurrenceRule = {
    frequency: string; // Frequency
    interval?: number;
    endDate?: string;
    occurrence?: number;
  };
}
