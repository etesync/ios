#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(EteSyncNative, NSObject)

RCT_EXTERN_METHOD(hashEvent:(NSString *)eventId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(calculateHashesForEvents:(NSString *)calendarId from:(nonnull NSNumber *)from to:(nonnull NSNumber *)to resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(hashReminder:(NSString *)reminderId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(calculateHashesForReminders:(NSString *)calendarId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(hashContact:(NSString *)contactId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(calculateHashesForContacts:(NSString *)containerId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
