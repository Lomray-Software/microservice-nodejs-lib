// @see https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
export const LOG_INTERNAL_COLOR = '\x1b[36m%s\x1b[0m'; // cyan

export const LOG_EXTERNAL_COLOR = '\x1b[34m%s\x1b[0m'; // blue

export const LOG_INFO_COLOR = '\x1b[32m%s\x1b[0m'; // green

export const LOG_ERROR_COLOR = '\x1b[31m%s\x1b[0m'; // red

export const PROCESS_EXIT_EVENT_TYPES = [
  // 'exit',
  'SIGINT',
  'SIGUSR1',
  'SIGUSR2',
  'uncaughtException',
  'SIGTERM',
];

export enum EXCEPTION_CODE {
  ENDPOINT_EXCEPTION = -33000,
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  INVALID_PARAMS = -32602,
  METHOD_NOT_FOUND = -32601,
  MICROSERVICE_DOWN = -34000,
  MICROSERVICE_NOT_FOUND = -33200,
  GATEWAY_HANDLER_EXCEPTION = -33300,
  SOCKET_HANDLER_EXCEPTION = -33400,
}
