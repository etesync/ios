// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import moment from "moment";
import { useSelector } from "react-redux";
import { FlatList, View } from "react-native";
import { Menu, Divider, Appbar, Text, List, useTheme } from "react-native-paper";
import { useNavigation, RouteProp } from "@react-navigation/native";

import { useSyncGateEb } from "./SyncGate";
import { StoreState } from "./store";
import { DecryptedItem } from "./store/reducers";
import Container from "./widgets/Container";
import { Title } from "./widgets/Typography";

import { TaskType, EventType, ContactType, parseString } from "./pim-types";

import { defaultColor } from "./helpers";

import ColorBox from "./widgets/ColorBox";

const iconDeleted = (props: any) => (<List.Icon {...props} color="#F20C0C" icon="delete" />);
const iconChanged = (props: any) => (<List.Icon {...props} color="#FEB115" icon="pencil" />);

type RootStackParamList = {
  CollectionChangelogScreen: {
    colUid?: string;
  };
};

interface PropsType {
  route: RouteProp<RootStackParamList, "CollectionChangelogScreen">;
}

export default function CollectionChangelogScreen(props: PropsType) {
  const navigation = useNavigation();
  const syncGate = useSyncGateEb();
  const theme = useTheme();
  const syncStateJournals = useSelector((state: StoreState) => state.sync.stateJournals);
  const decryptedCollections = useSelector((state: StoreState) => state.cache2.decryptedCollections);
  const decryptedItems = useSelector((state: StoreState) => state.cache2.decryptedItems);

  if (syncGate) {
    return syncGate;
  }

  const colUid = props.route.params.colUid ?? "";
  const decryptedCollection = decryptedCollections.get(colUid);
  const colDecryptedItems = decryptedItems.get(colUid);

  if (!decryptedCollection || !colDecryptedItems) {
    return <Text>Error</Text>;
  }

  const { meta, collectionType } = decryptedCollection;

  const entriesList = Array.from(colDecryptedItems.entries()).map(([uid, val]) => ({ uid, ...val })).sort((a_, b_) => {
    const a = a_.meta.mtime ?? 0;
    const b = b_.meta.mtime ?? 0;
    return b - a;
  });

  function renderEntry(param: { item: DecryptedItem & { uid: string } }) {
    const item = param.item;
    const comp = parseString(item.content);

    const icon = (item.isDeleted) ? iconDeleted : iconChanged;

    let name;
    if (comp.name === "vcalendar") {
      if (EventType.isEvent(comp)) {
        const vevent = EventType.fromVCalendar(comp);
        name = vevent.summary;
      } else {
        const vtodo = TaskType.fromVCalendar(comp);
        name = vtodo.summary;
      }
    } else if (comp.name === "vcard") {
      const vcard = new ContactType(comp);
      name = vcard.fn;
    } else {
      name = "Error processing entry";
    }

    const mtime = (item.meta.mtime) ? moment(item.meta.mtime) : undefined;

    return (
      <List.Item
        key={item.uid}
        left={icon}
        title={name}
        description={mtime?.format("llll")}
        onPress={() => { navigation.navigate("CollectionItem", { colUid, itemUid: item.uid }) }}
      />
    );
  }

  let collectionColorBox: React.ReactNode;
  switch (collectionType) {
    case "CALENDAR":
    case "TASKS":
      collectionColorBox = (
        <ColorBox size={36} color={meta.color || defaultColor} />
      );
      break;
  }

  function RightAction() {
    const [showMenu, setShowMenu] = React.useState(false);

    return (
      <Menu
        visible={showMenu}
        onDismiss={() => setShowMenu(false)}
        anchor={(
          <Appbar.Action icon="dots-vertical" accessibilityLabel="Menu" onPress={() => setShowMenu(true)} />
        )}
      >
        <Menu.Item icon="pencil" title="Edit"
          onPress={() => {
            setShowMenu(false);
            navigation.navigate("CollectionEdit", { colUid });
          }}
        />
        <Menu.Item icon="account-multiple" title="Members"
          onPress={() => {
            setShowMenu(false);
            navigation.navigate("CollectionMembers", { colUid });
          }}
        />
        {syncStateJournals.has(colUid) &&
          <Menu.Item icon="import" title="Import"
            onPress={() => {
              setShowMenu(false);
              navigation.navigate("CollectionImport", { colUid });
            }}
          />
        }
      </Menu>
    );
  }

  navigation.setOptions({
    headerRight: () => (
      <RightAction />
    ),
  });

  return (
    <>
      <Container style={{ flexDirection: "row" }}>
        <View style={{ marginRight: "auto" }}>
          <Title>{meta.name}</Title>
          <Text>
            Change log items: {entriesList.length}
          </Text>
        </View>
        {collectionColorBox}
      </Container>
      <Divider />
      <FlatList
        style={[{ backgroundColor: theme.colors.background }, { flex: 1 }]}
        data={entriesList}
        keyExtractor={(item) => item.uid}
        renderItem={renderEntry}
        maxToRenderPerBatch={10}
      />
    </>
  );
}
