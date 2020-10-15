// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";

import { useSelector } from "react-redux";
import { StyleSheet } from "react-native";
import { Text, FAB } from "react-native-paper";
import { RouteProp } from "@react-navigation/native";

import { useSyncGateEb } from "./SyncGate";
import { StoreState } from "./store";

import ScrollView from "./widgets/ScrollView";
import Container from "./widgets/Container";

import CollectionItemContact from "./CollectionItemContact";
import CollectionItemEvent from "./CollectionItemEvent";
import CollectionItemTask from "./CollectionItemTask";

type RootStackParamList = {
  CollectionItemScreen: {
    colUid: string;
    itemUid: string;
  };
};

interface PropsType {
  route: RouteProp<RootStackParamList, "CollectionItemScreen">;
}

export default function CollectionItemScreen(props: PropsType) {
  const [showRaw, setShowRaw] = React.useState(false);
  const syncGate = useSyncGateEb();
  const decryptedCollections = useSelector((state: StoreState) => state.cache2.decryptedCollections);
  const decryptedItems = useSelector((state: StoreState) => state.cache2.decryptedItems);

  if (syncGate) {
    return syncGate;
  }

  const { colUid, itemUid } = props.route.params;
  const collection = decryptedCollections.get(colUid)!;
  const items = decryptedItems.get(colUid)!;

  const item = items.get(itemUid)!;

  let content;
  let fabContentIcon = "";
  switch (collection.collectionType) {
    case "etebase.vcard":
      content = <CollectionItemContact collection={collection} item={item} />;
      fabContentIcon = "account-card-details";
      break;
    case "etebase.vevent":
      content = <CollectionItemEvent collection={collection} item={item} />;
      fabContentIcon = "calendar";
      break;
    case "etebase.vtodo":
      content = <CollectionItemTask collection={collection} item={item} />;
      fabContentIcon = "format-list-checkbox";
      break;
  }

  return (
    <>
      <ScrollView style={{ flex: 1 }}>
        {showRaw ? (
          <Container>
            <Text>{item.content}</Text>
          </Container>
        ) : (
          content
        )}
      </ScrollView>
      <FAB
        icon={showRaw ? fabContentIcon : "text-subject"}
        accessibilityLabel={(showRaw) ? "Show item" : "Show raw item"}
        color="white"
        style={styles.fab}
        onPress={() => setShowRaw(!showRaw)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
