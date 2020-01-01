//
//  EXContactsExposed.h
//  etesync
//
//  Created by Me Me on 01/01/2020.
//  Copyright © 2020 650 Industries, Inc. All rights reserved.
//

#ifndef EXContactsExposed_h
#define EXContactsExposed_h

#import <UMCore/UMExportedModule.h>
#import <UMCore/UMModuleRegistryConsumer.h>

#import <Contacts/Contacts.h>
#import <ContactsUI/ContactsUI.h>

@interface EXContacts : UMExportedModule <UMModuleRegistryConsumer>
- (void)_mutateContact:(CNMutableContact *)contact
              withData:(NSDictionary *)data
              resolver:(UMPromiseResolveBlock)resolve
              rejecter:(UMPromiseRejectBlock)reject;
@end
#endif /* EXContactsExposed_h */
