import * as React from 'react';
import { useNavigation } from './navigation/Hooks';
import { ScrollView, Image, Linking } from 'react-native';
import { Subheading, Divider, List, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-navigation';

import { useCredentials } from './login';
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
  const etesync = useCredentials().value;

  return (
    <>
      <SafeAreaView style={{ backgroundColor: '#424242' }}>
        <Container>
          <Image
            style={{ width: 48, height: 48, marginBottom: 15 }}
            source={require('./images/icon.png')}
          />
          <Subheading style={{ color: 'white' }}>{C.appName}</Subheading>
          { etesync &&
            <Text style={{ color: 'white' }}>{etesync.credentials.email}</Text>
          }
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
        <Divider />
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

