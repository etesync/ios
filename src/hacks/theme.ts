import { Theme as PaperTheme } from 'react-native-paper';

export type Theme = PaperTheme & {
  colors: {
    primaryBackground: string,
  },
};

let _theme: Theme;

export function setTheme(theme: Theme) {
  _theme = theme;
}

// FIXME: shitty version of useTheme until we have https://github.com/callstack/react-native-paper/pull/1184
export function useTheme() {
  return _theme;
}
