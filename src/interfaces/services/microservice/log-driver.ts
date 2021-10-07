/**
 * Log messages type
 */
enum LogType {
  IN_INTERNAL,
  OUT_INTERNAL,
  IN_EXTERNAL,
  OUT_EXTERNAL,
  INFO,
  ERROR,
}

/**
 * Log driver type
 */
type LogDriverType = (getMessage: () => string, type?: LogType, id?: number) => void;

export { LogDriverType, LogType };
