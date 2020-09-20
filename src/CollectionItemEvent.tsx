// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";

import Color from "color";

import { Text } from "react-native-paper";

import { DecryptedCollection, DecryptedItem } from "./store";

import Container from "./widgets/Container";
import Small from "./widgets/Small";

import { EventType } from "./pim-types";
import { formatDateRange, formatOurTimezoneOffset } from "./helpers";

import JournalItemHeader from "./JournalItemHeader";

interface PropsType {
  collection: DecryptedCollection;
  item: DecryptedItem;
}

export default React.memo(function CollectionItemEvent(props: PropsType) {
  const entry = props.item;
  const event = EventType.parse(entry.content);

  const timezone = event.timezone;

  const backgroundColor = props.collection.meta.color;
  const foregroundColor = Color(backgroundColor).isLight() ? "black" : "white";

  return (
    <>
      <JournalItemHeader title={event.summary} foregroundColor={foregroundColor} backgroundColor={backgroundColor}>
        <Text style={{ color: foregroundColor }}>{formatDateRange(event.startDate, event.endDate)} {timezone && <Small>({formatOurTimezoneOffset()})</Small>}</Text>
        <Text style={{ textDecorationLine: "underline", color: foregroundColor }}>{event.location}</Text>
      </JournalItemHeader>
      <Container>
        <Text style={{ fontVariant: ["tabular-nums"] }}>{event.description}</Text>
        {(event.attendees.length > 0) && (
          <Text>Attendees: {event.attendees.map((x) => (x.getFirstValue())).join(", ")}</Text>)}
      </Container>
    </>
  );
});
