import * as React from 'react';
import { useNavigation } from './navigation/Hooks';
import { ScrollView, Image, Linking } from 'react-native';
import { List, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-navigation';

import Separator from './widgets/Separator';
import Container from './widgets/Container';

import * as C from './constants';

const menuItems = [
  {
    title: 'About',
    path: 'About',
    icon: 'info',
  },
  {
    title: 'Settings',
    path: 'Settings',
    icon: 'settings',
  },
];

const externalMenuItems = [
  {
    title: 'Web site',
    link: C.homePage,
    icon: 'home',
  },
  {
    title: 'FAQ',
    link: C.faq,
    icon: 'forum',
  },
  {
    title: 'Report issue',
    link: C.reportIssue,
    icon: 'bug-report',
  },
  {
    title: 'Contact developer',
    link: '',
    icon: 'email',
  },
];

function Drawer() {
  const navigation = useNavigation();

  return (
    <>
      <SafeAreaView style={{ backgroundColor: '#424242' }}>
        <Container style={{ flex: 0 }}>
          <Image
            style={{ width: 48, height: 48, marginBottom: 15 }}
            source={require('./images/icon.png')}
          />
          <Text style={{ color: 'white' }}>{C.appName}</Text>
        </Container>
      </SafeAreaView>
      <ScrollView style={{ flex: 1}}>
        <>
          { menuItems.map((menuItem) => (
              <List.Item
                key={menuItem.title}
                title={menuItem.title}
                onPress={() => navigation.navigate(menuItem.path)}
                left={(props) => <List.Icon {...props} icon={menuItem.icon} />}
              />
          )) }
        </>
        <Separator />
        <List.Section title="External links">
          { externalMenuItems.map((menuItem) => (
              <List.Item
                key={menuItem.title}
                title={menuItem.title}
                onPress={() => Linking.openURL(menuItem.link)}
                left={(props) => <List.Icon {...props} icon={menuItem.icon} />}
              />
          )) }
        </List.Section>
      </ScrollView>
    </>
  );
}

export default Drawer;

