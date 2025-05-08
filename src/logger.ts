export enum LogLevel {
  Warning = 'warning',
  Log = 'log',
  Info = 'info',
  Debug = 'debug',
}

type LoggerData = {
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type Logger = (level: LogLevel, message: string, data?: LoggerData) => void;

export function createDefaultLogger(): Logger {
  return (level, message, data) => {
    const lvl = level === LogLevel.Warning ? 'warn' : level;
    const args = [`Holyheld SDK: ${level}:`, message];

    if (data) {
      console[lvl](...args, data);
    } else {
      console[lvl](...args);
    }
  };
}
