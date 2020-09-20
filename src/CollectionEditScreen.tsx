// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { useSelector } from "react-redux";
import { TextInput as NativeTextInput } from "react-native";
import { Text, HelperText, Button, Appbar, Paragraph } from "react-native-paper";
import { useNavigation, RouteProp } from "@react-navigation/native";

import { SyncManager } from "./sync/SyncManager";
import { useSyncGateEb } from "./SyncGate";
import { useCredentials } from "./credentials";
import { StoreState, useAsyncDispatch } from "./store";
import { collectionUpload, performSync } from "./store/actions";

import TextInput from "./widgets/TextInput";
import ScrollView from "./widgets/ScrollView";
import Container from "./widgets/Container";
import ConfirmationDialog from "./widgets/ConfirmationDialog";
import ErrorOrLoadingDialog from "./widgets/ErrorOrLoadingDialog";

import { useLoading, colorHtmlToInt, defaultColor } from "./helpers";

import ColorPicker from "./widgets/ColorPicker";

interface FormErrors {
  name?: string;
  color?: string;
}

type RootStackParamList = {
  CollectionEditScreen: {
    colUid?: string;
    colType?: string;
  };
};

interface PropsType {
  route: RouteProp<RootStackParamList, "CollectionEditScreen">;
}

export default function CollectionEditScreen(props: PropsType) {
  const [errors, setErrors] = React.useState({} as FormErrors);
  const [colType, setColType] = React.useState<string>();
  const [name, setName] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");
  const [color, setColor] = React.useState<string>("");
  const dispatch = useAsyncDispatch();
  const decryptedCollections = useSelector((state: StoreState) => state.cache2.decryptedCollections);
  const cacheCollections = useSelector((state: StoreState) => state.cache2.collections);
  const syncGate = useSyncGateEb();
  const navigation = useNavigation();
  const etebase = useCredentials()!;
  const [loading, error, setPromise] = useLoading();

  const colUid: string = props.route.params.colUid ?? "";
  React.useMemo(() => {
    if (syncGate) {
      return;
    }

    const passedCollection = decryptedCollections.get(colUid);
    if (passedCollection) {
      const { meta } = passedCollection;
      setColType(meta.type);
      setName(meta.name);
      setDescription(meta.description ?? "");
      if (meta.color !== undefined) {
        setColor(meta.color);
      }
    } else {
      setColType(props.route.params.colType);
    }

  }, [syncGate, colUid]);

  if (syncGate) {
    return syncGate;
  }

  if (!colType) {
    return <React.Fragment />;
  }

  function onSave() {
    setPromise(async () => {
      const saveErrors: FormErrors = {};
      const fieldRequired = "This field is required!";

      if (!name) {
        saveErrors.name = fieldRequired;
      }

      if (color && !colorHtmlToInt(color)) {
        saveErrors.color = "Must be of the form #RRGGBB or #RRGGBBAA or empty";
      }

      if (Object.keys(saveErrors).length > 0) {
        setErrors(saveErrors);
        return;
      }

      const colMgr = etebase.getCollectionManager();
      const meta = { type: colType!, name, description, color };
      let collection;
      if (colUid) {
        collection = colMgr.cacheLoad(cacheCollections.get(colUid)!);
        const colMeta = await collection.getMeta();
        await collection.setMeta({ ...colMeta, ...meta });
      } else {
        collection = await colMgr.create(meta, "");
      }

      await dispatch(collectionUpload(colMgr, collection));
      navigation.goBack();
      // FIXME having the sync manager here is ugly. We should just deal with these changes centrally.
      const syncManager = SyncManager.getManager(etebase);
      dispatch(performSync(syncManager.sync())); // not awaiting on puprose
    });
  }

  const descriptionRef = React.createRef<NativeTextInput>();

  let collectionColorBox: React.ReactNode;
  switch (colType) {
    case "etebase.vevent":
    case "etebase.vtodo":
      collectionColorBox = (
        <>
          <ColorPicker
            error={errors.color}
            defaultColor={defaultColor}
            color={color}
            onChange={setColor}
          />
        </>
      );
      break;
  }

  navigation.setOptions({
    headerRight: () => (
      <RightAction colUid={colUid} />
    ),
  });

  return (
    <ScrollView keyboardAware>
      <Container>
        <ErrorOrLoadingDialog
          loading={loading}
          error={error}
          onDismiss={() => setPromise(undefined)}
        />
        <TextInput
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => descriptionRef.current!.focus()}
          error={!!errors.name}
          onChangeText={setName}
          label="Display name (title)"
          accessibilityLabel="Display name (title)"
          value={name}
        />
        <HelperText
          type="error"
          visible={!!errors.name}
        >
          {errors.name}
        </HelperText>

        <TextInput
          ref={descriptionRef}
          onChangeText={setDescription}
          label="Description (optional)"
          accessibilityLabel="Description (optional)"
          value={description}
        />
        <HelperText
          type="error"
          visible={false}
        />

        {collectionColorBox}

        <Button
          mode="contained"
          disabled={loading}
          onPress={onSave}
        >
          <Text>{loading ? "Loading…" : "Save"}</Text>
        </Button>
      </Container>
    </ScrollView>
  );
}

function RightAction(props: { colUid: string }) {
  const [confirmationVisible, setConfirmationVisible] = React.useState(false);
  const navigation = useNavigation();
  const etebase = useCredentials()!;
  const dispatch = useAsyncDispatch();
  const cacheCollections = useSelector((state: StoreState) => state.cache2.collections);

  const colUid = props.colUid;
  if (!colUid) {
    return <React.Fragment />;
  }

  return (
    <React.Fragment>
      <Appbar.Action
        icon="delete"
        accessibilityLabel="Delete collection"
        onPress={() => {
          setConfirmationVisible(true);
        }}
      />
      <ConfirmationDialog
        title="Are you sure?"
        visible={confirmationVisible}
        onOk={async () => {
          const colMgr = etebase.getCollectionManager();
          const collection = colMgr.cacheLoad(cacheCollections.get(colUid)!);
          await collection.delete();
          await colMgr.upload(collection);
          navigation.navigate("home");
          // FIXME having the sync manager here is ugly. We should just deal with these changes centrally.
          const syncManager = SyncManager.getManager(etebase);
          dispatch(performSync(syncManager.sync())); // not awaiting on puprose
        }}
        onCancel={() => {
          setConfirmationVisible(false);
        }}
      >
        <Paragraph>This colection and all of its data will be removed from the server.</Paragraph>
      </ConfirmationDialog>
    </React.Fragment>
  );
}
