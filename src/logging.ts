class Logger {
  public debug(message: any) {
    console.log(message);
  }

  public info(message: any) {
    console.log(message);
  }

  public warn(message: any) {
    console.warn(message);
  }

  public critical(message: any) {
    console.warn(message);
  }
}

export const logger = new Logger();
