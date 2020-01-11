// Copyright 2015-present 650 Industries. All rights reserved.

#import <EventKit/EventKit.h>

@interface EteEXCalendar : NSObject

- (EKEvent *)deserializeEvent:(EKEvent *)calendarEvent details:(NSDictionary *)details reject:(RCTPromiseRejectBlock)reject;
- (EKReminder *)deserializeReminder:(EKReminder *)reminder details:(NSDictionary *)details reject:(RCTPromiseRejectBlock)reject;

@end
