/**
 * Log messages type
 */
enum LogType {
  REQ_INTERNAL,
  RES_INTERNAL,
  REQ_EXTERNAL,
  RES_EXTERNAL,
  INFO,
  ERROR,
}

/**
 * Log driver type
 */
type LogDriverType = (getMessage: () => string, type?: LogType, id?: number | string) => void;

type ConsoleInfoType = (log?: (color: string, message: string) => void) => LogDriverType;

export { LogDriverType, LogType, ConsoleInfoType };
