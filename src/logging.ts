enum LogLevel {
  Critical = 1,
  Warning,
  Info,
  Debug,
}

const logLevel = (__DEV__) ? LogLevel.Debug : LogLevel.Info;

function shouldLog(messageLevel: LogLevel) {
  return __DEV__ && (messageLevel <= logLevel);
}

class Logger {
  public debug(message: any) {
    if (shouldLog(LogLevel.Debug)) {
      console.log(message);
    }
  }

  public info(message: any) {
    if (shouldLog(LogLevel.Info)) {
      console.log(message);
    }
  }

  public warn(message: any) {
    if (shouldLog(LogLevel.Warning)) {
      console.warn(message);
    }
  }

  public critical(message: any) {
    if (shouldLog(LogLevel.Critical)) {
      console.warn(message);
    }
  }
}

export const logger = new Logger();
