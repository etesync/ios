import * as React from 'react';
import * as EteSync from 'etesync';

import Color from 'color';

import { Text } from 'react-native-paper';

import { SyncInfoItem } from './store';

import Container from './widgets/Container';
import Small from './widgets/Small';

import { EventType } from './pim-types';
import { formatDateRange, formatOurTimezoneOffset, colorIntToHtml } from './helpers';

import JournalItemHeader from './JournalItemHeader';

interface PropsType {
  collection: EteSync.CollectionInfo;
  entry: SyncInfoItem;
}

export default React.memo(function JournalItemEvent(props: PropsType) {
  const entry = props.entry;
  const event = EventType.parse(entry.content);

  const timezone = event.timezone;

  const backgroundColor = colorIntToHtml(props.collection.color);
  const foregroundColor = Color(backgroundColor).isLight() ? 'black' : 'white';

  return (
    <>
      <JournalItemHeader title={event.summary} foregroundColor={foregroundColor} backgroundColor={backgroundColor}>
        <Text style={{ color: foregroundColor }}>{formatDateRange(event.startDate, event.endDate)} {timezone && <Small>({formatOurTimezoneOffset()})</Small>}</Text>
        <Text style={{ textDecorationLine: 'underline', color: foregroundColor }}>{event.location}</Text>
      </JournalItemHeader>
      <Container>
        <Text style={{ fontVariant: ['tabular-nums'] }}>{event.description}</Text>
        {(event.attendees.length > 0) && (
          <Text>Attendees: {event.attendees.map((x) => (x.getFirstValue())).join(', ')}</Text>)}
      </Container>
    </>
  );
});
