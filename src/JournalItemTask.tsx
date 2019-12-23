import * as React from 'react';
import * as EteSync from 'etesync';

import Color from 'color';

import { Text } from 'react-native-paper';

import { SyncInfoItem } from './store';

import Container from './widgets/Container';
import Small from './widgets/Small';

import { TaskType } from './pim-types';
import { formatDate, formatOurTimezoneOffset, colorIntToHtml } from './helpers';

import JournalItemHeader from './JournalItemHeader';

interface PropsType {
  collection: EteSync.CollectionInfo;
  entry: SyncInfoItem;
}

export default React.memo(function JournalItemTask(props: PropsType) {
  const entry = props.entry;
  const task = TaskType.parse(entry.content);

  const timezone = task.timezone;

  const backgroundColor = colorIntToHtml(props.collection.color);
  const foregroundColor = Color(backgroundColor).isLight() ? 'black' : 'white';

  return (
    <>
      <JournalItemHeader title={task.summary} foregroundColor={foregroundColor} backgroundColor={backgroundColor}>
        {task.startDate &&
          <Text style={{ color: foregroundColor }}>Start: {formatDate(task.startDate)} {timezone && <Small>({formatOurTimezoneOffset()})</Small>}</Text>
        }
        {task.dueDate &&
          <Text style={{ color: foregroundColor }}>Due: {formatDate(task.dueDate)} {timezone && <Small>({formatOurTimezoneOffset()})</Small>}</Text>
        }
        <Text style={{ textDecorationLine: 'underline' }}>{task.location}</Text>
      </JournalItemHeader>
      <Container>
        <Text style={{ fontVariant: ['tabular-nums'] }}>{task.description}</Text>
        {(task.attendees.length > 0) && (
          <Text>Attendees: {task.attendees.map((x) => (x.getFirstValue())).join(', ')}</Text>)}
      </Container>
    </>
  );
});
