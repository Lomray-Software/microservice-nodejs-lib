import dns from 'dns';
import axios from 'axios';
import { expect } from 'chai';
import sinon from 'sinon';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import ConsoleLogDriver from '@drivers/console-log';
import {
  MiddlewareHandler,
  MiddlewareType,
} from '@interfaces/services/microservice/i-microservice';
import Microservice from '@services/microservice';

describe('services/microservice', () => {
  const options = { name: 'tests', connection: 'http://my.local:8001', version: undefined };
  const ms = Microservice.create(options);

  // For test middlewares
  const endpointTriggerMiddleware = 'middleware-endpoint';
  const middlewareHandlerBefore: MiddlewareHandler = ({ task }) =>
    (task.getMethod() === endpointTriggerMiddleware && {
      ...task.getParams(),
      middleware: 'before',
    }) ||
    undefined;
  const middlewareHandlerAfter: MiddlewareHandler = ({ task, result }) =>
    (task.getMethod() === endpointTriggerMiddleware && { ...result, middleware: 'after' }) ||
    undefined;
  const middlewareHandlerUndefined: MiddlewareHandler = () => undefined;

  /**
   * Helper for run microservice
   */
  const createAxiosMock = async (task: Record<string, any>, shouldRunMicroservice = true) => {
    const sandbox = sinon.createSandbox();

    const spy = sandbox
      .stub(axios, 'request')
      // First call getTask (see worker)
      .onCall(0)
      .resolves({ data: task, method: 'POST' })
      // Throw error for exit from infinite loop (stop worker)
      .onCall(1)
      .rejects({ message: 'socket hang up' });

    if (shouldRunMicroservice) {
      await ms.start();
      sandbox.restore();
    }

    return { sandbox, spy };
  };

  before(() => {
    sinon.stub(process, 'exit');
    sinon.stub(console, 'info');
  });

  after(() => {
    sinon.restore();
  });

  it('should correct create microservice', () => {
    expect(ms).instanceof(Microservice);
  });

  it('should correct set default log driver', () => {
    expect(ms).to.have.property('logDriver').equal(ConsoleLogDriver);
  });

  it('should correct set options', () => {
    expect(ms).to.have.property('options').property('version').equal('1.0.0');
  });

  it('should correct add endpoint handler', () => {
    const testEndpoint = 'endpoint';
    const endpointHandler = () => ({ hello: 'world' });

    ms.addEndpoint(testEndpoint, endpointHandler);

    expect(ms)
      .to.have.property('endpoints')
      .deep.equal({ [testEndpoint]: endpointHandler });
  });

  it('should correct add middleware handler', () => {
    ms.addMiddleware(middlewareHandlerBefore);
    ms.addMiddleware(middlewareHandlerAfter, MiddlewareType.response);
    ms.addMiddleware(middlewareHandlerUndefined, MiddlewareType.response);

    expect(ms)
      .to.have.property('middlewares')
      .deep.equal({
        [MiddlewareType.request]: [middlewareHandlerBefore],
        [MiddlewareType.response]: [middlewareHandlerAfter, middlewareHandlerUndefined],
      });
  });

  it('should correct add onExit handler', () => {
    const onExitHandler = sinon.spy(() => undefined);

    ms.onExit(onExitHandler);

    process.emit('exit', 1);

    expect(onExitHandler).calledOnceWith(1);
  });

  it('should correct return connection string (SRV)', async () => {
    const srvHost = 'http://srv.local';

    const sandbox = sinon.createSandbox();

    sandbox.stub(ms, 'options' as any).value({ connection: srvHost, isSRV: true });
    sandbox
      .stub(dns, 'resolveSrv')
      .callsFake((domain, callback) =>
        callback(null, [{ priority: 1, weight: 1, name: 'srv.local', port: 8001 }]),
      );

    const connection = await ms.getConnection();

    sandbox.restore();

    expect(connection).to.equal(`${srvHost}:8001`);
  });

  it('should correct return connection string (not SRV)', async () => {
    const connection = await ms.getConnection();

    expect(connection).to.equal(options.connection);
  });

  it('should correct start worker & return error unknown method & return base microservice exception', async () => {
    const req = new MicroserviceRequest({ id: 1, method: 'sample' });

    const { spy } = await createAxiosMock(req.toJSON());
    const firstCall = spy.getCall(0).firstArg;
    const secondCall = spy.getCall(1).firstArg;

    expect(firstCall.url).to.equal(`/${options.name}`);
    expect(firstCall.data).to.undefined;

    expect(secondCall.url).to.undefined;
    expect(secondCall.data.getError()).to.instanceof(BaseException);
    expect(secondCall.data.toString().includes('Unknown method')).to.ok;
  });

  it('should correct start worker & return success response', async () => {
    const endpoint = 'get-string';
    const result = { good: 'job' };
    const req = new MicroserviceRequest({ id: 2, method: endpoint, params: { hello: 1 } });

    ms.addEndpoint(endpoint, () => result);

    const { spy } = await createAxiosMock(req.toJSON());
    const secondCall = spy.getCall(1).firstArg;

    expect(secondCall.data.getResult()).to.deep.equal(result);
  });

  it('should correct start worker & return success response handled by middlewares', async () => {
    const result = { success: true };
    const req = new MicroserviceRequest({
      id: 2,
      method: endpointTriggerMiddleware,
      params: { hello: 1 },
    });
    const handler = sinon.spy(() => result);

    ms.addEndpoint(endpointTriggerMiddleware, handler);

    const { spy } = await createAxiosMock(req.toJSON());
    const secondCall = spy.getCall(1).firstArg;

    expect(secondCall.data.getResult()).to.deep.equal({ ...result, middleware: 'after' });
    expect(handler.firstCall.firstArg).to.deep.equal({ ...req.getParams(), middleware: 'before' });
  });

  it('should correct start worker & return endpoint exception', async () => {
    const method = 'need-exception';
    const req = new MicroserviceRequest({ id: 2, method });

    ms.addEndpoint(method, () => {
      throw new Error('Endpoint error');
    });

    const { spy } = await createAxiosMock(req.toJSON());
    const secondCall = spy.getCall(1).firstArg;
    const error = secondCall.data.getError();

    expect(error).to.instanceof(BaseException);
    expect(secondCall.data.toString().includes('Endpoint exception')).to.ok;
  });
});
