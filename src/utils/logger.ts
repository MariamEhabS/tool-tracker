/**
 * Development-only logger utility
 * Prevents console output in production builds
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]): void => {
    if (isDev) console.log(...args);
  },
  error: (...args: unknown[]): void => {
    if (isDev) console.error(...args);
  },
  warn: (...args: unknown[]): void => {
    if (isDev) console.warn(...args);
  },
  info: (...args: unknown[]): void => {
    if (isDev) console.info(...args);
  },
  debug: (...args: unknown[]): void => {
    if (isDev) console.debug(...args);
  },
  table: (data: unknown, columns?: string[]): void => {
    if (isDev) console.table(data, columns);
  },
  group: (label?: string): void => {
    if (isDev) console.group(label);
  },
  groupEnd: (): void => {
    if (isDev) console.groupEnd();
  },
  time: (label?: string): void => {
    if (isDev) console.time(label);
  },
  timeEnd: (label?: string): void => {
    if (isDev) console.timeEnd(label);
  },
};

export default logger;
