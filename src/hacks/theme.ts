import { DefaultTheme } from 'react-native-paper';
let _theme = DefaultTheme;

export function setTheme(theme: any) {
  _theme = theme;
}

// FIXME: shitty version of useTheme until we have https://github.com/callstack/react-native-paper/pull/1184
export function useTheme() {
  return _theme;
}
