import * as React from 'react';

import { Title, useTheme } from 'react-native-paper';

import Container from './widgets/Container';

interface HeaderPropsType {
  title: string;
  foregroundColor?: string;
  backgroundColor?: string;
}

export default function JournalItemHeader(props: React.PropsWithChildren<HeaderPropsType>) {
  const theme = useTheme();

  return (
    <Container style={{ backgroundColor: props.backgroundColor ?? theme.colors.accent }}>
      <Title style={{ color: props.foregroundColor }}>{props.title}</Title>
      {props.children}
    </Container>
  );
}

