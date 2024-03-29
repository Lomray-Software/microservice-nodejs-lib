import { performance } from 'perf_hooks';
import {
  LOG_ERROR_COLOR,
  LOG_EXTERNAL_COLOR,
  LOG_INFO_COLOR,
  LOG_INTERNAL_COLOR,
} from '@constants/index';
import type { ConsoleInfoType } from '@interfaces/drivers/console-log';
import { LogType } from '@interfaces/drivers/console-log';

const reqIds = new Map();

/**
 * @constructor
 */
const ConsoleLog: ConsoleInfoType =
  (log, logLevel = LogType.REQ_INTERNAL) =>
  (getMessage, type = LogType.INFO, id = 0) => {
    let color = '';
    let reqTime = '';

    if (type < logLevel) {
      return;
    }

    switch (type) {
      case LogType.INFO:
        color = LOG_INFO_COLOR;
        break;

      case LogType.ERROR:
        color = LOG_ERROR_COLOR;
        break;

      case LogType.REQ_INTERNAL:
      case LogType.RES_INTERNAL:
        color = LOG_INTERNAL_COLOR;
        break;

      case LogType.REQ_EXTERNAL:
      case LogType.RES_EXTERNAL:
        color = LOG_EXTERNAL_COLOR;
        break;
    }

    if (id) {
      switch (type) {
        case LogType.REQ_INTERNAL:
        case LogType.REQ_EXTERNAL:
          reqIds.set(`${type}|${id}`, performance.now());
          break;

        case LogType.RES_INTERNAL:
        case LogType.RES_EXTERNAL:
          const key = type === LogType.RES_INTERNAL ? LogType.REQ_INTERNAL : LogType.REQ_EXTERNAL;

          reqTime = `+${(performance.now() - reqIds.get(`${key}|${id}`)).toFixed(2)} ms \n`;
          reqIds.delete(key);
          break;

        case LogType.ERROR:
          reqIds.clear();
      }
    }

    if (log === undefined) {
      console.info(color, `${getMessage()} ${reqTime}`);
    } else if (log) {
      log(`${getMessage()} ${reqTime}`, { id, type, color, reqTime });
    }
  };

export default ConsoleLog;
