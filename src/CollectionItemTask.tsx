// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";

import Color from "color";

import { Text } from "react-native-paper";

import { DecryptedCollection, DecryptedItem } from "./store";

import Container from "./widgets/Container";
import Small from "./widgets/Small";

import { TaskType } from "./pim-types";
import { formatDate, formatOurTimezoneOffset } from "./helpers";

import JournalItemHeader from "./JournalItemHeader";

interface PropsType {
  collection: DecryptedCollection;
  item: DecryptedItem;
}

export default React.memo(function CollectionItemTask(props: PropsType) {
  const entry = props.item;
  const task = TaskType.parse(entry.content);

  const timezone = task.timezone;

  const backgroundColor = props.collection.meta.color;
  const foregroundColor = Color(backgroundColor).isLight() ? "black" : "white";

  return (
    <>
      <JournalItemHeader title={task.summary} foregroundColor={foregroundColor} backgroundColor={backgroundColor}>
        {task.startDate &&
          <Text style={{ color: foregroundColor }}>Start: {formatDate(task.startDate)} {timezone && <Small>({formatOurTimezoneOffset()})</Small>}</Text>
        }
        {task.dueDate &&
          <Text style={{ color: foregroundColor }}>Due: {formatDate(task.dueDate)} {timezone && <Small>({formatOurTimezoneOffset()})</Small>}</Text>
        }
        <Text style={{ textDecorationLine: "underline" }}>{task.location}</Text>
      </JournalItemHeader>
      <Container>
        <Text style={{ fontVariant: ["tabular-nums"] }}>{task.description}</Text>
        {(task.attendees.length > 0) && (
          <Text>Attendees: {task.attendees.map((x) => (x.getFirstValue())).join(", ")}</Text>)}
      </Container>
    </>
  );
});
