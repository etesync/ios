import * as React from 'react';
import moment from 'moment';
import * as EteSync from 'etesync';

import { Clipboard, Linking } from 'react-native';
import { Text, List, Divider } from 'react-native-paper';

import { SyncInfoItem } from './store';

import Container from './widgets/Container';

import { ContactType } from './pim-types';

import JournalItemHeader from './JournalItemHeader';

interface PropsType {
  collection: EteSync.CollectionInfo;
  entry: SyncInfoItem;
}

export default React.memo(function JournalItemContact(props: PropsType) {
  const entry = props.entry;
  const contact = ContactType.parse(entry.content);

  const revProp = contact.comp.getFirstProperty('rev');
  const lastModified = (revProp) ? moment(revProp.getFirstValue().toJSDate()).format('LLLL') : undefined;

  const lists = [];

  function getAllType(
    propName: string,
    leftIcon: string,
    valueToHref?: (value: string, type: string) => string,
    primaryTransform?: (value: string, type: string) => string,
    secondaryTransform?: (value: string, type: string) => string) {

    return contact.comp.getAllProperties(propName).map((prop, idx) => {
      const type = prop.toJSON()[1].type;
      const values = prop.getValues().map((val) => {
        const primaryText = primaryTransform ? primaryTransform(val, type) : val;

        const href = valueToHref?.(val, type);
        const onPress = (href && Linking.canOpenURL(href)) ? (() => { Linking.openURL(href) }) : undefined;

        return (
          <List.Item
            key={idx}
            title={primaryText}
            onPress={onPress}
            onLongPress={() => Clipboard.setString(primaryText)}
            left={(props) => <List.Icon {...props} icon={leftIcon} />}
            description={secondaryTransform ? secondaryTransform(val, type) : type}
          />
        );
      });
      return values;
    });
  }

  lists.push(getAllType(
    'tel',
    'phone',
    (x) => ('tel:' + x)
  ));

  lists.push(getAllType(
    'email',
    'email',
    (x) => ('mailto:' + x)
  ));

  lists.push(getAllType(
    'impp',
    'chat',
    (x) => x,
    (x) => (x.substring(x.indexOf(':') + 1)),
    (x) => (x.substring(0, x.indexOf(':')))
  ));

  lists.push(getAllType(
    'adr',
    'home'
  ));

  lists.push(getAllType(
    'bday',
    'calendar',
    undefined,
    ((x: any) => moment(x.toJSDate()).format('dddd, LL')),
    () => 'Birthday'
  ));

  lists.push(getAllType(
    'anniversary',
    'calendar',
    undefined,
    ((x: any) => moment(x.toJSDate()).format('dddd, LL')),
    () => 'Anniversary'
  ));

  const skips = ['tel', 'email', 'impp', 'adr', 'bday', 'anniversary', 'rev',
    'prodid', 'uid', 'fn', 'n', 'version', 'photo'];
  const theRest = contact.comp.getAllProperties().filter((prop) => (
    skips.indexOf(prop.name) === -1
  )).map((prop, idx) => {
    const values = prop.getValues().map((_val) => {
      const val = (_val instanceof String) ? _val : _val.toString();
      return (
        <List.Item
          key={idx}
          title={val}
          onLongPress={() => Clipboard.setString(val)}
          description={prop.name}
        />
      );
    });
    return values;
  });

  function listIfNotEmpty(items: JSX.Element[][]) {
    if (items.length > 0) {
      return (
        <React.Fragment>
          {items}
          <Divider inset />
        </React.Fragment>
      );
    } else {
      return undefined;
    }
  }

  return (
    <>
      <JournalItemHeader title={contact.fn}>
        {lastModified && (
          <Text>Modified: {lastModified}</Text>
        )}
      </JournalItemHeader>
      <Container>
        {lists.map((list, idx) => (
          <React.Fragment key={idx}>
            {listIfNotEmpty(list)}
          </React.Fragment>
        ))}
        {theRest}
      </Container>
    </>
  );
});
