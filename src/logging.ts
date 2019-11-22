import { AsyncStorage } from 'react-native';

export enum LogLevel {
  Off = 0,
  Critical,
  Warning,
  Info,
  Debug,
}

let logLevel = (__DEV__) ? LogLevel.Debug : LogLevel.Off;

export function setLogLevel(level: LogLevel) {
  logLevel = level;
}

function shouldLog(messageLevel: LogLevel) {
  return messageLevel <= logLevel;
}

function logPrint(messageLevel: LogLevel, message: any) {
  if (!shouldLog(messageLevel)) {
    return;
  }

  switch (messageLevel) {
    case LogLevel.Critical:
    case LogLevel.Warning:
      console.warn(message);
      break;
    default:
      console.log(message);
  }
}

const logIdentifier = '__logging_';

function logToBuffer(messageLevel: LogLevel, message: any) {
  if (!shouldLog(messageLevel)) {
    return;
  }

  AsyncStorage.setItem(`${logIdentifier}${new Date()}`, `${messageLevel}: ${message}`);
}

async function getLogKeys() {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(logIdentifier));
}

export async function getLogs() {
  const wantedKeys = await getLogKeys();
  if (wantedKeys.length === 0) {
    return [];
  }

  const wantedItems = await AsyncStorage.multiGet(wantedKeys);
  return wantedItems.map(([_key, value]) => value);
}

export async function clearLogs() {
  const wantedKeys = await getLogKeys();
  if (wantedKeys.length === 0) {
    return;
  }
  await AsyncStorage.multiRemove(wantedKeys);
}

const logHandler = (__DEV__) ? logPrint : logToBuffer;

class Logger {
  public debug(message: any) {
    logHandler(LogLevel.Debug, message);
  }

  public info(message: any) {
    logHandler(LogLevel.Info, message);
  }

  public warn(message: any) {
    logHandler(LogLevel.Warning, message);
  }

  public critical(message: any) {
    logHandler(LogLevel.Critical, message);
  }
}

export const logger = new Logger();
