// Copyright 2015-present 650 Industries. All rights reserved.

#import <EventKit/EventKit.h>

#import <UMCore/UMUtilities.h>
#import <React/RCTBridgeModule.h>

#import "EteEXCalendar.h"

@interface EteEXCalendar ()

@property (nonatomic, strong) EKEventStore *eventStore;

@end

@implementation EteEXCalendar


- (EKEvent *)deserializeEvent:(EKEvent *)calendarEvent details:(NSDictionary *)details reject:(RCTPromiseRejectBlock)reject
{
  NSString *title = details[@"title"];
  NSString *location = details[@"location"];
  NSDate *startDate = [UMUtilities NSDate:details[@"startDate"]];
  NSDate *endDate = [UMUtilities NSDate:details[@"endDate"]];
  // NSDate *instanceStartDate = [UMUtilities NSDate:details[@"instanceStartDate"]];
  NSNumber *allDay = details[@"allDay"];
  NSString *notes = details[@"notes"];
  NSString *timeZone = details[@"timeZone"];
  NSString *url = details[@"url"];
  NSArray *alarms = details[@"alarms"];
  NSDictionary *recurrenceRule = details[@"recurrenceRule"];
  NSString *availability = details[@"availability"];

  if (title) {
    calendarEvent.title = title;
  } else if (details[@"title"] == [NSNull null]) {
    calendarEvent.title = nil;
  }

  if (location) {
    calendarEvent.location = location;
  } else if (details[@"location"] == [NSNull null]) {
    calendarEvent.location = nil;
  }

  if (notes) {
    calendarEvent.notes = notes;
  } else if (details[@"notes"] == [NSNull null]) {
    calendarEvent.notes = nil;
  }

  if (details[@"timeZone"] == [NSNull null]) {
    calendarEvent.timeZone = nil;
  } else if (timeZone) {
    NSTimeZone *eventTimeZone = [NSTimeZone timeZoneWithName:timeZone];
    if (eventTimeZone) {
      calendarEvent.timeZone = eventTimeZone;
    } else {
      reject(@"E_EVENT_INVALID_TIMEZONE", @"Invalid timeZone", nil);
      return nil;
    }
  }

  if (alarms) {
    calendarEvent.alarms = [self _createCalendarEventAlarms:alarms];
  } else if (details[@"alarms"] == [NSNull null]) {
    calendarEvent.alarms = nil;
  }

  if (recurrenceRule) {
    EKRecurrenceRule *rule = [self _createRecurrenceRule:recurrenceRule];
    if (rule) {
      calendarEvent.recurrenceRules = @[ rule ];
    }
  } else if (details[@"recurrenceRule"] == [NSNull null]) {
    calendarEvent.recurrenceRules = nil;
  }

  NSURL *URL = [NSURL URLWithString:[url stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLHostAllowedCharacterSet]]];
  if (URL) {
    calendarEvent.URL = URL;
  } else if (details[@"url"] == [NSNull null]) {
    calendarEvent.URL = nil;
  }

  if (startDate) {
    calendarEvent.startDate = startDate;
  } else if (details[@"startDate"] == [NSNull null]) {
    calendarEvent.startDate = nil;
  }

  if (endDate) {
    calendarEvent.endDate = endDate;
  } else if (details[@"endDate"] == [NSNull null]) {
    calendarEvent.endDate = nil;
  }

  if (allDay) {
    calendarEvent.allDay = [allDay boolValue];
  }

  if (availability) {
    calendarEvent.availability = [self _availabilityConstant:availability];
  }

  return calendarEvent;
}


- (EKReminder *)deserializeReminder:(EKReminder *)reminder details:(NSDictionary *)details reject:(RCTPromiseRejectBlock)reject
{
  NSDate *startDate = [UMUtilities NSDate:details[@"startDate"]];
  NSDate *dueDate = [UMUtilities NSDate:details[@"dueDate"]];
  NSDate *completionDate = [UMUtilities NSDate:details[@"completionDate"]];
  NSNumber *completed = details[@"completed"];
  NSString *title = details[@"title"];
  NSString *location = details[@"location"];
  NSString *notes = details[@"notes"];
  NSString *timeZone = details[@"timeZone"];
  NSArray *alarms = details[@"alarms"];
  NSDictionary *recurrenceRule = details[@"recurrenceRule"];
  NSString *url = details[@"url"];

  NSCalendar *currentCalendar = [NSCalendar currentCalendar];

  if (title) {
    reminder.title = title;
  } else if (details[@"title"] == [NSNull null]) {
    reminder.title = nil;
  }

  if (location) {
    reminder.location = location;
  } else if (details[@"location"] == [NSNull null]) {
    reminder.location = nil;
  }

  if (notes) {
    reminder.notes = notes;
  } else if (details[@"notes"] == [NSNull null]) {
    reminder.notes = nil;
  }

  if (details[@"timeZone"] == [NSNull null]) {
    reminder.timeZone = nil;
  } else if (timeZone) {
    NSTimeZone *eventTimeZone = [NSTimeZone timeZoneWithName:timeZone];
    if (eventTimeZone) {
      reminder.timeZone = eventTimeZone;
    } else {
      reject(@"E_EVENT_INVALID_TIMEZONE", @"Invalid timeZone", nil);
      return nil;
    }
  }

  if (alarms) {
    reminder.alarms = [self _createCalendarEventAlarms:alarms];
  } else if (details[@"alarms"] == [NSNull null]) {
    reminder.alarms = nil;
  }

  if (recurrenceRule) {
    EKRecurrenceRule *rule = [self _createRecurrenceRule:recurrenceRule];
    if (rule) {
      reminder.recurrenceRules = @[ rule ];
    }
  } else if (details[@"recurrenceRule"] == [NSNull null]) {
    reminder.recurrenceRules = nil;
  }

  NSURL *URL = [NSURL URLWithString:[url stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLHostAllowedCharacterSet]]];
  if (URL) {
    reminder.URL = URL;
  } else if (details[@"url"] == [NSNull null]) {
    reminder.URL = nil;
  }

  if (startDate) {
    NSDateComponents *startDateComponents = [currentCalendar components:(NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitSecond) fromDate:startDate];
    reminder.startDateComponents = startDateComponents;
  } else if (details[@"startDate"] == [NSNull null]) {
    reminder.startDateComponents = nil;
  }

  if (dueDate) {
    NSDateComponents *dueDateComponents = [currentCalendar components:(NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitSecond) fromDate:dueDate];
    reminder.dueDateComponents = dueDateComponents;
  } else if (details[@"dueDate"] == [NSNull null]) {
    reminder.dueDateComponents = nil;
  }

  if (completed) {
    reminder.completed = [completed boolValue];
  }

  if (completionDate) {
    reminder.completionDate = completionDate;
  } else if (details[@"completionDate"] == [NSNull null]) {
    reminder.completionDate = nil;
  }

  return reminder;
}

- (EKAlarm *)_createCalendarEventAlarm:(NSDictionary *)alarm
{
  EKAlarm *calendarEventAlarm = nil;

  NSDate *date = [UMUtilities NSDate:alarm[@"absoluteDate"]];
  NSNumber *relativeOffset = alarm[@"relativeOffset"];

  if (date) {
    calendarEventAlarm = [EKAlarm alarmWithAbsoluteDate:date];
  } else if (relativeOffset) {
    calendarEventAlarm = [EKAlarm alarmWithRelativeOffset:(60 * [relativeOffset intValue])];
  } else {
    calendarEventAlarm = [[EKAlarm alloc] init];
  }

  if ([alarm objectForKey:@"structuredLocation"] && [[alarm objectForKey:@"structuredLocation"] count]) {
    NSDictionary *locationOptions = [alarm valueForKey:@"structuredLocation"];
    NSDictionary *geo = [locationOptions valueForKey:@"coords"];
    CLLocation *geoLocation = [[CLLocation alloc] initWithLatitude:[[geo valueForKey:@"latitude"] doubleValue]
                               longitude:[[geo valueForKey:@"longitude"] doubleValue]];

    calendarEventAlarm.structuredLocation = [EKStructuredLocation locationWithTitle:[locationOptions valueForKey:@"title"]];
    calendarEventAlarm.structuredLocation.geoLocation = geoLocation;
    calendarEventAlarm.structuredLocation.radius = [[locationOptions valueForKey:@"radius"] doubleValue];

    if ([[locationOptions valueForKey:@"proximity"] isEqualToString:@"enter"]) {
      calendarEventAlarm.proximity = EKAlarmProximityEnter;
    } else if ([[locationOptions valueForKey:@"proximity"] isEqualToString:@"leave"]) {
      calendarEventAlarm.proximity = EKAlarmProximityLeave;
    } else {
      calendarEventAlarm.proximity = EKAlarmProximityNone;
    }
  }
  return calendarEventAlarm;
}

- (NSArray *)_createCalendarEventAlarms:(NSArray *)alarms
{
  NSMutableArray *calendarEventAlarms = [[NSMutableArray alloc] init];
  for (NSDictionary *alarm in alarms) {
    if ([alarm count] && ([alarm valueForKey:@"absoluteDate"] || [alarm valueForKey:@"relativeOffset"] || [alarm objectForKey:@"structuredLocation"])) {
      EKAlarm *reminderAlarm = [self _createCalendarEventAlarm:alarm];
      [calendarEventAlarms addObject:reminderAlarm];
    }
  }
  return [calendarEventAlarms copy];
}

- (NSArray *)_stringArrayToIntArray:(NSArray *)array
{
  if (!array) {
    return array;
  }

  NSMutableArray *ret = [[NSMutableArray alloc] init];

  for (NSString *item in array) {
    [ret addObject:[NSNumber numberWithInteger: [item integerValue]]];
  }

  return ret;
}

- (EKRecurrenceRule *)_createRecurrenceRule:(NSDictionary *)recurrenceRule
{
  NSString *frequency = recurrenceRule[@"frequency"];
  NSArray *validFrequencyTypes = @[@"daily", @"weekly", @"monthly", @"yearly"];
  NSInteger interval = [recurrenceRule[@"interval"] integerValue];
  NSInteger occurrence = [recurrenceRule[@"occurrence"] integerValue];
  NSDate *endDate = nil;

  if (!frequency || ![validFrequencyTypes containsObject:frequency]) {
    return nil;
  }

  if (recurrenceRule[@"endDate"]) {
      endDate = [UMUtilities NSDate:recurrenceRule[@"endDate"]];
  }

  NSMutableArray *daysOfTheWeek = nil;
  NSArray *daysOfTheMonth = [self _stringArrayToIntArray: recurrenceRule[@"daysOfTheMonth"]];
  NSArray *monthsOfTheYear = [self _stringArrayToIntArray: recurrenceRule[@"monthsOfTheYear"]];
  NSArray *weeksOfTheYear = [self _stringArrayToIntArray: recurrenceRule[@"weeksOfTheYear"]];
  NSArray *daysOfTheYear = [self _stringArrayToIntArray: recurrenceRule[@"daysOfTheYear"]];
  NSArray *setPositions = [self _stringArrayToIntArray: recurrenceRule[@"setPositions"]];

  if (recurrenceRule[@"daysOfTheWeek"]) {
    daysOfTheWeek = [[NSMutableArray alloc] init];

    for (NSDictionary *item in recurrenceRule[@"daysOfTheWeek"]) {
      [daysOfTheWeek addObject:[[EKRecurrenceDayOfWeek alloc] initWithDayOfTheWeek:[item[@"dayOfTheWeek"] integerValue]
                    weekNumber:[item[@"weekNumber"] integerValue]]];
    }
  }

  EKRecurrenceEnd *recurrenceEnd = nil;
  NSInteger recurrenceInterval = 1;
  if (endDate) {
    recurrenceEnd = [EKRecurrenceEnd recurrenceEndWithEndDate:endDate];
  } else if (occurrence && occurrence > 0) {
    recurrenceEnd = [EKRecurrenceEnd recurrenceEndWithOccurrenceCount:occurrence];
  }

  if (interval > 1) {
    recurrenceInterval = interval;
  }

  EKRecurrenceRule *rule = [[EKRecurrenceRule alloc] initRecurrenceWithFrequency:[self _recurrenceFrequency:frequency]
                            interval:recurrenceInterval
                       daysOfTheWeek:daysOfTheWeek
                      daysOfTheMonth:daysOfTheMonth
                     monthsOfTheYear:monthsOfTheYear
                      weeksOfTheYear:weeksOfTheYear
                       daysOfTheYear:daysOfTheYear
                        setPositions:setPositions
                                 end:recurrenceEnd];
  return rule;
}

- (EKRecurrenceFrequency)_recurrenceFrequency:(NSString *)name
{
  if ([name isEqualToString:@"weekly"]) {
    return EKRecurrenceFrequencyWeekly;
  }
  if ([name isEqualToString:@"monthly"]) {
    return EKRecurrenceFrequencyMonthly;
  }
  if ([name isEqualToString:@"yearly"]) {
    return EKRecurrenceFrequencyYearly;
  }
  return EKRecurrenceFrequencyDaily;
}

- (EKEventAvailability)_availabilityConstant:(NSString *)string
{
  if([string isEqualToString:@"busy"]) {
    return EKEventAvailabilityBusy;
  }
  if([string isEqualToString:@"free"]) {
    return EKEventAvailabilityFree;
  }
  if([string isEqualToString:@"tentative"]) {
    return EKEventAvailabilityTentative;
  }
  if([string isEqualToString:@"unavailable"]) {
    return EKEventAvailabilityUnavailable;
  }
  return EKEventAvailabilityNotSupported;
}

@end
