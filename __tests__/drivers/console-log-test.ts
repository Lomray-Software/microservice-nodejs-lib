import { expect } from 'chai';
import sinon from 'sinon';
import {
  LOG_ERROR_COLOR,
  LOG_EXTERNAL_COLOR,
  LOG_INFO_COLOR,
  LOG_INTERNAL_COLOR,
} from '@constants/index';
import ConsoleLog from '@drivers/console-log';
import { LogType } from '@interfaces/drivers/console-log';

describe('drivers/console-log', () => {
  const message = 'hello world';
  const getMessage = () => message;

  beforeEach(() => {
    console.info?.['resetHistory']();
  });

  it('should correct log default type output', () => {
    ConsoleLog()(getMessage);

    expect(console.info).calledOnceWith(LOG_INFO_COLOR, sinon.match(message));
  });

  it('should correct log IN INTERNAL output', () => {
    ConsoleLog()(getMessage, LogType.REQ_INTERNAL, 1);

    expect(console.info).calledOnceWith(LOG_INTERNAL_COLOR, sinon.match(message));
  });

  it('should correct log OUT INTERNAL output', () => {
    ConsoleLog()(getMessage, LogType.RES_INTERNAL, 1);

    expect(console.info).calledOnceWith(LOG_INTERNAL_COLOR, sinon.match(message));
  });

  it('should correct log IN EXTERNAL output', () => {
    ConsoleLog()(getMessage, LogType.REQ_EXTERNAL, 1);

    expect(console.info).calledOnceWith(LOG_EXTERNAL_COLOR, sinon.match(message));
  });

  it('should correct log OUT EXTERNAL output', () => {
    ConsoleLog()(getMessage, LogType.RES_EXTERNAL, 1);

    expect(console.info).calledOnceWith(LOG_EXTERNAL_COLOR, sinon.match(message));
  });

  it('should correct log INFO output', () => {
    ConsoleLog()(getMessage, LogType.INFO, 1);

    expect(console.info).calledOnceWith(LOG_INFO_COLOR, sinon.match(message));
  });

  it('should correct log ERROR output', () => {
    ConsoleLog()(getMessage, LogType.ERROR, 1);

    expect(console.info).calledOnceWith(LOG_ERROR_COLOR, sinon.match(message));
  });

  it('should log with custom output logger', () => {
    const custom = sinon.stub();

    ConsoleLog(custom)(getMessage, LogType.ERROR, 1);

    expect(custom).calledOnceWith(sinon.match(message), {
      id: 1,
      type: LogType.ERROR,
      color: LOG_ERROR_COLOR,
      reqTime: '',
    });
  });

  it('should correct working log level output', () => {
    ConsoleLog(undefined, LogType.ERROR)(getMessage, LogType.INFO, 1);

    expect(console.info).not.called;
  });
});
