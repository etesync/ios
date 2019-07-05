import * as React from 'react';
import { Appbar } from 'react-native-paper';
import { HeaderProps } from 'react-navigation';

type PropsType = HeaderProps;

const AppHeader = React.memo(function _AppHeader(props: PropsType) {
  const { navigation } = props;
  const showMenuButton = getScreenOption(props.scene, 'showMenuButton');

  const backAction = (showMenuButton) ? (
    <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} />
    ) : (
    <Appbar.BackAction onPress={() => navigation.goBack()} />
  );

  const rightAction = getScreenOption(props.scene, 'rightAction');

  return (
    <Appbar.Header>
      {backAction}
      <Appbar.Content title={getHeaderTitleString(props.scene)} />
      {rightAction}
    </Appbar.Header>
  );
});

function getScreenOption(scene: any, optionName: string) {
  const options = scene.descriptor.options;
  return options[optionName];
}

// From react-navigation
function getHeaderTitleString(scene: any) {
  const options = scene.descriptor.options;
  if (typeof options.headerTitle === 'string') {
    return options.headerTitle;
  }

  if (options.title && typeof options.title !== 'string' && __DEV__) {
    throw new Error(
      `Invalid title for route "${
        scene.route.routeName
      }" - title must be string or null, instead it was of type ${typeof options.title}`
    );
  }

  return options.title;
}

export default AppHeader;
