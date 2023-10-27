export enum LogLevel {
  Warning = 'warning',
  Log = 'log',
  Info = 'info',
  Debug = 'debug',
}

export type Logger = (
  level: LogLevel,
  message: string,
  data?: {
    [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  },
) => void;

export function createDefaultLogger(): Logger {
  return (level, message, data) => {
    const lvl = level === LogLevel.Warning ? 'warn' : level;
    console[lvl](`Holyheld SDK: ${level}:`, message, data);
  };
}
