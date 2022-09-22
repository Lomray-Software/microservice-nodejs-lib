/**
 * Log messages type
 */
enum LogType {
  REQ_INTERNAL = 0,
  RES_INTERNAL = 1,
  REQ_EXTERNAL = 2,
  RES_EXTERNAL = 3,
  INFO = 4,
  ERROR = 5,
}

/**
 * Log driver type
 */
type LogDriverType = (getMessage: () => string, type?: LogType, id?: number | string) => void;

type ConsoleInfoType = (
  logFunc?: (
    message: string,
    params: { type: LogType; color: string; reqTime: string; id?: number | string },
  ) => void,
  logLevel?: LogType,
) => LogDriverType;

export { LogDriverType, LogType, ConsoleInfoType };
