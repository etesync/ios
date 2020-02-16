import * as React from 'react';
import { ViewProps, View } from 'react-native';
import { Button } from 'react-native-paper';

import Container from './Container';
import ScrollView from './ScrollView';

export interface PagePropsType {
  prev?: () => void;
  next?: () => void;
  currentPage: number;
  totalPages: number;
}

export function WizardNavigationBar(props: PagePropsType) {
  const first = props.currentPage === 0;
  const last = props.currentPage === props.totalPages - 1;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' }}>
      <Button
        mode="contained"
        disabled={first}
        onPress={props.prev}
        accessibilityLabel="Previous"
      >
        Prev
      </Button>
      <Button
        mode="contained"
        color="green"
        onPress={props.next}
      >
        {(last) ? 'Finish' : 'Next'}
      </Button>
    </View>
  );
}

interface PropsType extends ViewProps {
  pages: ((props: PagePropsType) => React.ReactNode)[];
  onFinish: () => void;
}

export default function Wizard(inProps: PropsType) {
  const [currentPage, setCurrentPage] = React.useState(0);
  const { pages, onFinish, ...props } = inProps;

  const Content = pages[currentPage];

  const first = currentPage === 0;
  const last = currentPage === pages.length - 1;
  const prev = !first ? () => setCurrentPage(currentPage - 1) : undefined;
  const next = !last ? () => setCurrentPage(currentPage + 1) : onFinish;

  return (
    <ScrollView {...props}>
      <Container style={{ flex: 1, minHeight: '100%' }}>
        {Content({ prev, next, currentPage, totalPages: pages.length })}
      </Container>
    </ScrollView>
  );
}

