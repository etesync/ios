// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { useSelector } from "react-redux";
import { View } from "react-native";
import { Avatar, IconButton, Card, Menu, List, Colors, Text } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";

import moment from "moment";

import { defaultColor } from "../helpers";

import ScrollView from "../widgets/ScrollView";
import ColorBox from "../widgets/ColorBox";
import { useSyncGateEb } from "../SyncGate";

import { StoreState } from "../store";

const backgroundPrimary = Colors.amber700;

const JournalsMoreMenu = React.memo(function _JournalsMoreMenu(props: { journalType: string }) {
  const [showMenu, setShowMenu] = React.useState(false);
  const navigation = useNavigation();

  return (
    <Menu
      visible={showMenu}
      onDismiss={() => setShowMenu(false)}
      anchor={(
        <IconButton color="white" theme={{ colors: { primary: backgroundPrimary } }} accessibilityLabel="Journal menu" {...props} icon="dots-horizontal" onPress={() => setShowMenu(true)} />
      )}
    >
      <Menu.Item
        onPress={() => {
          setShowMenu(false);
          navigation.navigate("JournalNew", { journalType: props.journalType });
        }}
        title="Create new"
      />
    </Menu>
  );
});


export default function JournalListScreen() {
  const navigation = useNavigation();
  const syncGate = useSyncGateEb();
  const decryptedCollections = useSelector((state: StoreState) => state.cache2.decryptedCollections);
  const lastSync = useSelector((state: StoreState) => state.sync.lastSync);

  if (syncGate) {
    return syncGate;
  }

  const collectionsMap = {
    "etebase.vevent": [] as React.ReactNode[],
    "etebase.vcard": [] as React.ReactNode[],
    "etebase.vtodo": [] as React.ReactNode[],
  };

  for (const [uid, { meta }] of decryptedCollections.entries()) {
    if (!collectionsMap[meta.type]) {
      continue;
    }
    const readOnly = false; // FIXME-eb
    const shared = false; // FIXME-eb

    let colorBox: any;
    switch (meta.type) {
      case "etebase.vevent":
      case "etebase.vtodo":
        colorBox = (
          <ColorBox size={36} color={meta.color || defaultColor} />
        );
        break;
    }

    const rightIcon = (props: any) => (
      <View {...props} style={{ flexDirection: "row" }}>
        {shared &&
          <Avatar.Icon icon="account-multiple" size={36} style={{ backgroundColor: "transparent" }} />
        }
        {readOnly &&
          <Avatar.Icon icon="eye" size={36} style={{ backgroundColor: "transparent" }} />
        }
        {colorBox}
      </View>
    );

    collectionsMap[meta.type].push(
      <List.Item
        key={uid}
        onPress={() => navigation.navigate("Collection", { colUid: uid })}
        title={meta.name}
        right={rightIcon}
      />
    );
  }

  const cards = [
    {
      title: "Address Books",
      lookup: "etebase.vcard",
      icon: "contacts",
    },
    {
      title: "Calendars",
      lookup: "etebase.vevent",
      icon: "calendar",
    },
    {
      title: "Tasks",
      lookup: "etebase.vtodo",
      icon: "format-list-checkbox",
    },
  ];

  const shadowStyle = {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,

    elevation: 2,
  };

  return (
    <ScrollView style={{ flex: 1 }}>
      <Text style={{ textAlign: "center", marginTop: 15 }}>Last sync: {lastSync ? moment(lastSync).format("lll") : "never"}</Text>
      {cards.map((card) => (
        <Card key={card.lookup} accessible={false} elevation={4} style={{ margin: 20 }}>
          <Card.Title
            title={card.title}
            titleStyle={{ color: "white" }}
            style={{ ...shadowStyle, backgroundColor: backgroundPrimary }}
            left={(props) => (
              <View accessibilityElementsHidden>
                <Avatar.Icon color="white" theme={{ colors: { primary: backgroundPrimary } }} {...props} icon={card.icon} />
              </View>
            )}
            right={() => (
              <JournalsMoreMenu journalType={card.lookup} />
            )}
          />
          {collectionsMap[card.lookup]}
        </Card>
      ))}
    </ScrollView>
  );
}
