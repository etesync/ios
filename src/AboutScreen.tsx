// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Linking, FlatList } from "react-native";
import { Text, List, TouchableRipple, useTheme } from "react-native-paper";

import { Title } from "./widgets/Typography";
import Container from "./widgets/Container";
import Markdown from "./widgets/Markdown";

import { expo } from "../app.json";
import * as C from "./constants";

import * as licenses from "../licenses.json";

function generateRenderLicenseItem(pkgLicenses: any) {
  return function renderLicense(param: { item: string }) {
    const pkgName = param.item;
    const pkg = pkgLicenses[pkgName]!;
    const { publisher, repository, url } = pkg;
    const description = (publisher && (publisher.toLowerCase() !== pkgName.toLowerCase())) ? `${pkg.licenses} by ${publisher}` : pkg.licenses;
    const link = repository ?? url;
    return (
      <List.Item
        key={pkgName}
        title={pkgName}
        description={description}
        right={(props) => (<List.Icon {...props} icon="chevron-right" />)}
        onPress={link && (() => { Linking.openURL(link) })}
      />
    );
  };
}

const markdownContent = `
This app is made possible with financial support from [NLnet Foundation](https://nlnet.nl/), courtesy of [NGI0 Discovery](https://nlnet.nl/discovery) and the [European Commission](https://ec.europa.eu) [DG CNECT](https://ec.europa.eu/info/departments/communications-networks-content-and-technology_en)'s [Next Generation Internet](https://ngi.eu) programme.
`;

export default function AboutScreen() {
  const theme = useTheme();

  return (
    <FlatList
      ListHeaderComponent={() => (
        <Container>
          <Title style={{ textAlign: "center" }}>{C.appName} {expo.version}</Title>
          <TouchableRipple onPress={() => { Linking.openURL(C.homePage) }}>
            <Text style={{ textAlign: "center", color: theme.colors.accent, textDecorationLine: "underline", margin: 10 }}>{C.homePage}</Text>
          </TouchableRipple>
          <Markdown content={markdownContent} />

          <Title style={{ marginTop: 30 }}>Open Source Licenses</Title>
        </Container>
      )}
      data={Object.keys(licenses.dependencies)}
      keyExtractor={(item) => item}
      renderItem={generateRenderLicenseItem(licenses.dependencies)}
    />
  );
}
