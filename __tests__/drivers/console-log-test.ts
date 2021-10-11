import { expect } from 'chai';
import sinon from 'sinon';
import {
  LOG_INTERNAL_COLOR,
  LOG_INFO_COLOR,
  LOG_EXTERNAL_COLOR,
  LOG_ERROR_COLOR,
} from '@constants/index';
import ConsoleLogDriver from '@drivers/console-log';
import { LogType } from '@interfaces/drivers/log-driver';

describe('drivers/console-log', () => {
  const message = 'hello world';
  const getMessage = () => message;

  beforeEach(() => {
    sinon.stub(console, 'info');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should correct log default type output', () => {
    ConsoleLogDriver(getMessage);

    expect(console.info).calledOnceWith(LOG_INFO_COLOR, message);
  });

  it('should correct log IN INTERNAL output', () => {
    ConsoleLogDriver(getMessage, LogType.IN_INTERNAL, 1);

    expect(console.info).calledOnceWith(LOG_INTERNAL_COLOR, message);
  });

  it('should correct log OUT INTERNAL output', () => {
    ConsoleLogDriver(getMessage, LogType.OUT_INTERNAL, 1);

    expect(console.info).calledOnceWith(LOG_INTERNAL_COLOR, message);
  });

  it('should correct log IN EXTERNAL output', () => {
    ConsoleLogDriver(getMessage, LogType.IN_EXTERNAL, 1);

    expect(console.info).calledOnceWith(LOG_EXTERNAL_COLOR, message);
  });

  it('should correct log OUT EXTERNAL output', () => {
    ConsoleLogDriver(getMessage, LogType.OUT_EXTERNAL, 1);

    expect(console.info).calledOnceWith(LOG_EXTERNAL_COLOR, message);
  });

  it('should correct log INFO output', () => {
    ConsoleLogDriver(getMessage, LogType.INFO, 1);

    expect(console.info).calledOnceWith(LOG_INFO_COLOR, message);
  });

  it('should correct log ERROR output', () => {
    ConsoleLogDriver(getMessage, LogType.ERROR, 1);

    expect(console.info).calledOnceWith(LOG_ERROR_COLOR, message);
  });
});
