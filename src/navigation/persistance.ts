import { AsyncStorage } from 'react-native';

const persistenceKey = 'persistenceKey';
const persistNavigationState = async (navState: {}) => {
  try {
    await AsyncStorage.setItem(persistenceKey, JSON.stringify(navState));
  } catch (err) {
    // handle the error according to your needs
  }
};

const loadNavigationState = async () => {
  const jsonString = await AsyncStorage.getItem(persistenceKey);
  return jsonString ? JSON.parse(jsonString) : undefined;
};

export function getPersistenceFunctions() {
  return undefined;
  return __DEV__ ? {
    persistNavigationState,
    loadNavigationState,
  } : undefined;
}
