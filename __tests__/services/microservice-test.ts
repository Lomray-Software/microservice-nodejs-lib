import dns from 'dns';
import axios from 'axios';
import { expect } from 'chai';
import sinon from 'sinon';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import ConsoleLogDriver from '@drivers/console-log';
import {
  MiddlewareHandler,
  MiddlewareType,
} from '@interfaces/services/microservice/i-microservice';
import Microservice from '@services/microservice';

const notSupposedMessage = 'was not supposed to succeed';

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

  /**
   * Helper for run microservice
   */
  const createAxiosMock = async (task: Record<string, any>) => {
    const stubbed = sinon
      .stub(axios, 'request')
      // First call getTask (see worker)
      .onCall(0)
      .resolves({ data: task, method: 'POST' })
      // Throw error for exit from infinite loop (stop worker)
      .onCall(1)
      .rejects({ message: 'socket hang up' });

    await ms.start();
    stubbed.restore();

    return stubbed;
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

  it('should create microservice once', () => {
    expect(Microservice.create()).to.equal(ms);
  });

  it('should throw error if create microservice through constructor', () => {
    // @ts-ignore
    expect(() => new Microservice()).to.throw();
  });

  it('should correct set default log driver', () => {
    expect(ms).to.have.property('logDriver').equal(ConsoleLogDriver);
  });

  it('should correct set options', () => {
    expect(ms).to.have.property('options').property('version').equal('1.0.0');
  });

  it('should correct instantiate microservice without log driver', () => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Microservice, 'instance' as any).value(undefined);

    const localMs = Microservice.create({}, { logDriver: false });
    const driver = localMs['logDriver'];

    expect(driver).not.equal(ConsoleLogDriver);
    // noinspection JSVoidFunctionReturnValueUsed
    expect(driver(() => '')).to.undefined;

    sandbox.restore();
  });

  it('should correct instantiate microservice with custom log driver', () => {
    const logDriver = () => ({ hello: 'world' });
    const sandbox = sinon.createSandbox();

    sandbox.stub(Microservice, 'instance' as any).value(undefined);

    const localMs = Microservice.create({}, { logDriver });

    expect(localMs).to.have.property('logDriver').equal(logDriver);

    sandbox.restore();
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

    expect(ms)
      .to.have.property('middlewares')
      .deep.equal({
        [MiddlewareType.request]: [middlewareHandlerBefore],
        [MiddlewareType.response]: [middlewareHandlerAfter],
      });
  });

  it('should correct add onExit handler', () => {
    const onExitHandler = sinon.spy(() => undefined);

    ms.onExit(onExitHandler);

    // @ts-ignore
    process.emit('SIGINT', 1);

    expect(onExitHandler).calledOnceWith(1);
  });

  it('should correct catch onExit handler error', () => {
    const onExitHandler = sinon.spy(() => {
      throw new Error('Hello');
    });

    ms.onExit(onExitHandler);

    // @ts-ignore
    process.emit('SIGINT', 1);

    expect(onExitHandler).to.throw();
  });

  it('should correct return connection string (SRV)', async () => {
    const srvHost = 'http://srv.local';

    const sandbox = sinon.createSandbox();

    sandbox.stub(ms, 'options' as any).value({ connection: srvHost, isSRV: true });
    const spy = sandbox
      .stub(dns, 'resolveSrv')
      .callsFake((domain, callback) =>
        callback(null, [{ priority: 1, weight: 1, name: 'srv.local', port: 8001 }]),
      );

    const connection = await ms.getConnection();

    // Test cache resolved srv
    await ms.getConnection();

    sandbox.restore();

    expect(connection).to.equal(`${srvHost}:8001`);
    expect(spy).to.callCount(1);
  });

  it('should correct return connection string (not SRV)', async () => {
    const connection = await ms.getConnection();

    expect(connection).to.equal(options.connection);
  });

  it('should correct start worker & return error unknown method & return base microservice exception', async () => {
    const req = new MicroserviceRequest({ id: 1, method: 'sample' });

    const stubbed = await createAxiosMock(req.toJSON());
    const firstCall = stubbed.getCall(0).firstArg;
    const secondCall = stubbed.getCall(1).firstArg;

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

    const stubbed = await createAxiosMock(req.toJSON());
    const secondCall = stubbed.getCall(1).firstArg;

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

    const stubbed = await createAxiosMock(req.toJSON());
    const secondCall = stubbed.getCall(1).firstArg;

    expect(secondCall.data.getResult()).to.deep.equal({ ...result, middleware: 'after' });
    expect(handler.firstCall.firstArg).to.deep.equal({ ...req.getParams(), middleware: 'before' });
  });

  it('should correct start worker & return endpoint exception', async () => {
    const method = 'need-exception';
    const req = new MicroserviceRequest({ id: 2, method });
    const customErrorParams = { code: 1, payload: { hello: 'error' } };

    const handler = sinon
      .stub()
      .onCall(0)
      .callsFake(() => {
        throw new Error('Endpoint error');
      })
      .onCall(1)
      .callsFake(() => {
        throw new BaseException(customErrorParams);
      });

    ms.addEndpoint(method, handler);

    const stubbedFirst = await createAxiosMock(req.toJSON());
    const stubbedSecond = await createAxiosMock(req.toJSON());
    const secondCall = stubbedFirst.getCall(1).firstArg;
    const normalError = secondCall.data.getError();
    const fourthCall = stubbedSecond.getCall(1).firstArg;
    const customError = fourthCall.data.getError();

    expect(normalError).to.instanceof(BaseException);
    expect(customError).to.instanceof(BaseException);
    expect(secondCall.data.toString().includes('Endpoint exception')).to.ok;
    expect(customError).to.have.property('payload').to.deep.equal(customErrorParams.payload);
  });

  it('should correct start worker & return ijson exception & return success response', async () => {
    const req = new MicroserviceRequest({ id: 2, method: 'test' });

    const stubbed = sinon
      .stub(axios, 'request')
      // First call getTask (see worker)
      .onCall(0)
      .rejects({ message: 'error on start worker' })
      .onCall(1)
      .resolves({ data: req.toJSON(), method: 'POST' })
      // Throw error for exit from infinite loop (stop worker)
      .rejects({ message: 'socket hang up' });

    await ms.start();
    stubbed.restore();

    const secondCall = stubbed.secondCall.firstArg.data;

    expect(secondCall.getError()).to.instanceof(BaseException);
  });

  it('should correct send request to another microservice', async () => {
    const microservice = 'demo';
    const method = 'example';
    const response = { success: true };
    const params = { hi: 'world' };

    const stubbed = sinon.stub(axios, 'request').resolves({ data: { result: response } });
    const result = await ms.sendRequest(`${microservice}.${method}`, params);
    const { url, data } = stubbed.firstCall.firstArg;

    stubbed.restore();

    expect(result).to.instanceof(MicroserviceResponse);
    expect(result.getResult()).to.deep.equal(response);
    // Set correct microservice url
    expect(url).to.equal(`${options.connection}/${microservice}`);
    // Correct pass params to request
    expect(data.params).to.deep.equal(params);
    // Correct generate request id
    expect(data.id).to.not.empty;
  });

  it('should throw another microservice error - base exception', async () => {
    const message = 'Another error';
    const stubbed = sinon.stub(axios, 'request').resolves({ data: { error: { message } } });

    try {
      await ms.sendRequest('hello.world', {}, { shouldGenerateId: false });

      expect(notSupposedMessage).to.throw();
    } catch (e) {
      const { data } = stubbed.firstCall.firstArg;

      expect(e).to.instanceof(BaseException);
      expect(e.message).to.equal(message);
      // Correct disable autogenerate id
      expect(data.id).to.undefined;
    }

    stubbed.restore();
  });

  it('should throw another microservice error - error request', async () => {
    const errorMessage = 'Request error';
    const stubbed = sinon.stub(axios, 'request').rejects(new Error(errorMessage));

    try {
      await ms.sendRequest('micro.method2');

      expect(notSupposedMessage).to.throw();
    } catch (e) {
      expect(e).to.instanceof(BaseException);
      expect(e.message).to.equal(errorMessage);
    }

    stubbed.restore();
  });

  it('should throw another microservice error - error request 404', async () => {
    const stubbed = sinon.stub(axios, 'request').rejects({ response: { status: 404 } });

    try {
      await ms.sendRequest('micro.method');

      expect(notSupposedMessage).to.throw();
    } catch (e) {
      expect(e).to.instanceof(BaseException);
      expect(e.status).to.equal(404);
    }

    stubbed.restore();
  });
});
