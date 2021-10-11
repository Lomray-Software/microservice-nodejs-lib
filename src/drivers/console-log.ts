import {
  LOG_INTERNAL_COLOR,
  LOG_INFO_COLOR,
  LOG_EXTERNAL_COLOR,
  LOG_ERROR_COLOR,
} from '@constants/index';
import { LogDriverType, LogType } from '@interfaces/drivers/log-driver';

/**
 * @constructor
 */
const ConsoleLogDriver: LogDriverType = (getMessage, type = LogType.INFO) => {
  let color;

  switch (type) {
    case LogType.INFO:
      color = LOG_INFO_COLOR;
      break;

    case LogType.ERROR:
      color = LOG_ERROR_COLOR;
      break;

    case LogType.IN_INTERNAL:
    case LogType.OUT_INTERNAL:
      color = LOG_INTERNAL_COLOR;
      break;

    case LogType.IN_EXTERNAL:
    case LogType.OUT_EXTERNAL:
      color = LOG_EXTERNAL_COLOR;
      break;
  }

  console.info(color, getMessage());
};

export default ConsoleLogDriver;
