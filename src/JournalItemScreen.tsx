// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";

import { useSelector } from "react-redux";
import { StyleSheet } from "react-native";
import { Text, FAB, Appbar } from "react-native-paper";
import { RouteProp, useNavigation } from "@react-navigation/native";

import { useSyncGate } from "./SyncGate";
import { StoreState } from "./store";

import ScrollView from "./widgets/ScrollView";
import Container from "./widgets/Container";

import JournalItemContact from "./JournalItemContact";
import JournalItemEvent from "./JournalItemEvent";
import JournalItemTask from "./JournalItemTask";

type RootStackParamList = {
  JournalItemScreen: {
    journalUid: string;
    entryUid: string;
  };
};

interface PropsType {
  route: RouteProp<RootStackParamList, "JournalItemScreen">;
}

export default function JournalItemScreen(props: PropsType) {
  const [showRaw, setShowRaw] = React.useState(false);
  const navigation = useNavigation();
  const syncGate = useSyncGate();
  const syncInfoCollections = useSelector((state: StoreState) => state.cache.syncInfoCollection);
  const syncInfoEntries = useSelector((state: StoreState) => state.cache.syncInfoItem);

  if (syncGate) {
    return syncGate;
  }

  const { journalUid, entryUid } = props.route.params;
  const collection = syncInfoCollections.get(journalUid)!;
  const entries = syncInfoEntries.get(journalUid)!;

  const entry = entries.get(entryUid)!;

  let content;
  let fabContentIcon = "";
  switch (collection.type) {
    case "ADDRESS_BOOK":
      content = <JournalItemContact collection={collection} entry={entry} />;
      fabContentIcon = "account-card-details";
      break;
    case "CALENDAR":
      content = <JournalItemEvent collection={collection} entry={entry} />;
      fabContentIcon = "calendar";
      break;
    case "TASKS":
      content = <JournalItemTask collection={collection} entry={entry} />;
      fabContentIcon = "format-list-checkbox";
      break;
  }

  navigation.setOptions({
    headerRight: () => (
      <Appbar.Action icon="export" onPress={() => { navigation.navigate("JournalItemSave", { journalUid, entryUid }) }} />
    ),
  });

  return (
    <>
      <ScrollView style={{ flex: 1 }}>
        {showRaw ? (
          <Container>
            <Text>{entry.content}</Text>
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
