#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(EteSyncNative, NSObject)

RCT_EXTERN_METHOD(hashEvent:(NSString *)eventId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(calculateHashesForEvents:(NSString *)calendarId from:(nonnull NSNumber *)from to:(nonnull NSNumber *)to resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
