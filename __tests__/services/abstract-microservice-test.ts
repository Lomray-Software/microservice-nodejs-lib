/* eslint-disable camelcase */
import dns from 'dns';
import axios from 'axios';
import { expect } from 'chai';
import _ from 'lodash';
import sinon from 'sinon';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import ConsoleLog from '@drivers/console-log';
import type { MiddlewareHandler } from '@interfaces/services/i-abstract-microservice';
import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import AbstractMicroservice from '@services/abstract-microservice';
import Microservice from '@services/microservice';

const notSupposedMessage = 'was not supposed to succeed';
const stopMsMessage = 'socket hang up';

describe('services/abstract-microservice', () => {
  const options = {
    name: 'tests',
    connection: 'http://my.local:8001',
    version: undefined,
  };
  const ms = Microservice.create(options);

  // For test middlewares
  const endpointTriggerMiddleware = 'middleware-endpoint';
  const endpointExcludeMiddleware = 'middleware-endpoint-exclude';
  const middlewareHandlerBefore: MiddlewareHandler = ({ task }) =>
    (task.getMethod() === endpointTriggerMiddleware && {
      ...task.getParams(),
      middleware: 'before',
    }) ||
    undefined;
  const middlewareHandlerAfter: MiddlewareHandler = ({ result }) => ({
    ...result,
    middleware: 'after',
  });

  ms.addMiddleware(middlewareHandlerBefore);
  ms.addMiddleware(middlewareHandlerAfter, MiddlewareType.response, {
    match: `${endpointTriggerMiddleware}*`,
    exclude: [endpointExcludeMiddleware],
  });

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
      .rejects({ message: stopMsMessage });

    await ms.start();
    stubbed.restore();

    return stubbed;
  };

  const testEndpoint = 'endpoint';
  const endpointHandler = () => ({ hello: 'world' });

  const rpcChannels = {
    $info: {},
    'ms/demo': { worker_ids: [] },
    'ms/example': { worker_ids: ['worker-id'] },
    'ms/tests': { worker_ids: ['worker-id1', 'worker-id2'] },
    'events/demo': { worker_ids: [] },
    'events/example': { worker_ids: ['worker-id'] },
  };

  beforeEach(() => {
    sinon.stub(process, 'exit');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should correct create microservice', () => {
    expect(ms).instanceof(AbstractMicroservice);
  });

  it('should create microservice once', () => {
    expect(Microservice.create()).to.equal(ms);
  });

  it('should throw error if create microservice through constructor', () => {
    // @ts-ignore
    expect(() => new Microservice()).to.throw();
  });

  it('should correct set options', () => {
    expect(ms.getName()).to.equal(options.name);
    expect(ms).to.have.property('options').property('name').equal(options.name);
    expect(ms).to.have.property('options').property('version').equal('1.0.0');
  });

  it('should correct instantiate microservice without log driver', () => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Microservice, 'instance' as any).value(undefined);

    const localMs = Microservice.create({}, { logDriver: false });
    const driver = localMs['logDriver'];

    expect(driver).not.equal(ConsoleLog);
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

  it('should correct add middleware handler', () => {
    expect(ms).to.have.property('middlewares').to.have.property(MiddlewareType.request).lengthOf(1);
    expect(ms)
      .to.have.property('middlewares')
      .to.have.property(MiddlewareType.response)
      .lengthOf(1);
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

  it('should correct add endpoint handler', () => {
    ms.addEndpoint(testEndpoint, endpointHandler);

    expect(ms)
      .to.have.property('endpoints')
      .to.have.property(testEndpoint)
      .to.have.property('handler')
      .deep.equal(endpointHandler);
  });

  it('should correct add endpoint handler with options', () => {
    const endpoint = 'handler-with-options';
    const handler = () => ({});
    const handlerOptions = { isDisableMiddlewares: true };

    ms.addEndpoint(endpoint, handler, handlerOptions);

    const endpoints = ms.getEndpoints();

    expect(endpoints)
      .to.have.property(endpoint)
      .to.have.property('options')
      .to.include(handlerOptions);
  });

  it('should correctly remove endpoint handler', () => {
    ms.removeEndpoint(testEndpoint);

    const endpoints = ms.getEndpoints();

    expect(endpoints).to.not.have.property(testEndpoint);
  });

  it('should correctly start worker & return error unknown method & return base microservice exception', async () => {
    const req = new MicroserviceRequest({ id: 1, method: 'sample' });

    const stubbed = await createAxiosMock(req.toJSON());
    const firstCall = stubbed.getCall(0).firstArg;
    const secondCall = stubbed.getCall(1).firstArg;

    expect(firstCall.url).to.equal(`/${ms.getChannelPrefix()}/${options.name}`);
    expect(firstCall.data).to.undefined;
    expect(secondCall.url).to.undefined;
    expect(secondCall.data.getError()).to.instanceof(BaseException);
    expect(secondCall.data.toString().includes('Unknown method')).to.ok;
  });

  it('should correctly start worker & return error unknown method - internal request (private route)', async () => {
    const endpoint = 'sample-private';
    const req = new MicroserviceRequest({ id: 1, method: endpoint });

    ms.addEndpoint(endpoint, () => ({}), { isPrivate: true });

    const stubbed = await createAxiosMock(req.toJSON());
    const secondCall = stubbed.getCall(1).firstArg;

    expect(secondCall.data.getError()).to.instanceof(BaseException);
    expect(secondCall.data.toString().includes('Unknown method')).to.ok;
  });

  it('should correctly start worker & return success response', async () => {
    const endpoint = 'get-string';
    const result = { good: 'job' };
    const req = new MicroserviceRequest({ id: 2, method: endpoint, params: { hello: 1 } });

    ms.addEndpoint(endpoint, () => result);

    const stubbed = await createAxiosMock(req.toJSON());
    const secondCall = stubbed.getCall(1).firstArg;

    expect(secondCall.data.getResult()).to.deep.equal(result);
  });

  it('should correctly start worker & return success response handled by middlewares', async () => {
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

    _.unset(secondCall.data.getResult(), 'payload');

    expect(secondCall.data.getResult()).to.deep.equal({ ...result, middleware: 'after' });
    expect(handler.firstCall.firstArg).to.deep.equal({ ...req.getParams(), middleware: 'before' });
  });

  it('should correctly start worker & return success response without after middleware', async () => {
    const result = { success: true };
    const req = new MicroserviceRequest({
      id: 2,
      method: endpointExcludeMiddleware,
      params: { hello: 1 },
    });
    const handler = sinon.spy(() => result);

    ms.addEndpoint(endpointExcludeMiddleware, handler);

    const stubbed = await createAxiosMock(req.toJSON());
    const secondCall = stubbed.getCall(1).firstArg;

    expect(secondCall.data.getResult()).to.deep.equal({ ...result });
    expect(handler.firstCall.firstArg).to.deep.equal({ ...req.getParams() });
  });

  it('should correctly start worker & return endpoint exception', async () => {
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

  it('should correctly start worker & return ijson exception & return success response', async () => {
    const req = new MicroserviceRequest({ id: 2, method: 'test' });

    const stubbed = sinon
      .stub(axios, 'request')
      // First call getTask (see worker)
      .onCall(0)
      .rejects({ message: 'error on start worker' })
      .onCall(1)
      .resolves({ data: req.toJSON(), method: 'POST' })
      // Throw error for exit from infinite loop (stop worker)
      .rejects({ message: 'ECONNREFUSED' });

    await ms.start();
    stubbed.restore();

    const secondCall = stubbed.secondCall.firstArg.data;

    expect(secondCall.getError()).to.instanceof(BaseException);
  });

  it('should correctly send request to another microservice', async () => {
    const microservice = 'demo';
    const method = 'example';
    const response = { success: true };
    const params = { hi: 'world' };

    const stubbed = sinon.stub(axios, 'request').resolves({ data: { result: response } });
    const result = await ms.sendRequest(`${microservice}.${method}`, params);
    const { url, data } = stubbed.firstCall.firstArg;

    stubbed.restore();

    _.unset(data, 'params.payload.performance');

    expect(result).to.instanceof(MicroserviceResponse);
    expect(result.getResult()).to.deep.equal(response);
    // Set correctly microservice url
    expect(url).to.equal(`${options.connection}/${ms.getChannelPrefix()}/${microservice}`);
    // correctly pass params to request
    expect(data.params).to.deep.equal({
      ...params,
      payload: {
        isInternal: true,
        sender: 'tests',
      },
    });
    // correctly generate request id
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
      // correctly disable autogenerate id
      expect(data.id).to.undefined;
    }

    stubbed.restore();
  });

  it('should return microservice error - base exception', async () => {
    const message = 'Microservice base exception';
    const stubbed = sinon.stub(axios, 'request').resolves({ data: { error: { message } } });

    const resp = await ms.sendRequest(
      'hello.world.error',
      {},
      { shouldGenerateId: false, isThrowError: false },
    );

    expect(resp.getError()).to.deep.equal(new BaseException({ message }));

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

  it('should correctly remove middleware handler', () => {
    ms.removeMiddleware(middlewareHandlerBefore);
    ms.removeMiddleware(() => undefined);

    expect(ms).to.have.property('middlewares').to.have.property(MiddlewareType.request).lengthOf(0);
    expect(ms)
      .to.have.property('middlewares')
      .to.have.property(MiddlewareType.response)
      .lengthOf(1);
  });

  it('should correctly return channel prefix', () => {
    expect(ms).to.have.property('channelPrefix').to.equal(ms.getChannelPrefix());
  });

  it('should correctly return list of registered microservices', async () => {
    const stubbed = sinon.stub(axios, 'request').resolves({ data: rpcChannels });

    expect(await ms.lookup()).to.deep.equal(['demo', 'example', 'tests']);
    expect(await ms.lookup(true)).to.deep.equal(['example', 'tests']);

    stubbed.restore();
  });

  it('should correctly return list of microservice workers', async () => {
    const stubbed = sinon.stub(axios, 'request').resolves({ data: rpcChannels });

    expect(await ms.getWorkers()).to.deep.equal(rpcChannels['ms/tests'].worker_ids);
    expect(await ms.getWorkers('unknown')).to.deep.equal([]);

    stubbed.restore();
  });

  it('should correctly return event channel prefix', () => {
    expect(ms).to.have.property('eventChannelPrefix').to.equal(ms.getEventChannelPrefix());
  });

  it('should correctly add/get/remove event handler', () => {
    const handler = () => true;
    const channel = 'test.operations.channel';

    ms.addEventHandler(channel, handler);

    const isAdded = ms.getEventHandlers()[channel].indexOf(handler) !== -1;

    ms.removeEventHandler(channel, handler);

    const isRemoved = ms.getEventHandlers()[channel].indexOf(handler) === -1;

    expect(isAdded).to.ok;
    expect(isRemoved).to.ok;
  });

  it('should correctly publish event', async () => {
    const stubbed = sinon
      .stub(axios, 'request')
      // return rpc channels
      .onCall(0)
      .resolves({ data: rpcChannels })
      // send event on first channel successful
      .onCall(1)
      .resolves({ status: 200 })
      // send event on second channel failed
      .onCall(2)
      .rejects();
    const testData = { test: 1 };
    const eventName = 'test.event';

    const result = await Microservice.eventPublish(eventName, testData);
    const { url, data, headers } = stubbed.secondCall.firstArg;

    stubbed.restore();

    expect(result).to.equal(1);
    expect(url).to.equal(`/${ms.getEventChannelPrefix()}/demo`);
    expect(headers).to.deep.equal({ type: 'async' });
    expect(data).to.deep.equal({ ...testData, payload: { eventName, sender: options.name } });
  });

  it('should throw error when publish event', async () => {
    const message = 'publish event error';
    const stubbed = sinon.stub(axios, 'request').rejects(new Error(message));
    const channel = 'test.error';

    const result = await Microservice.eventPublish(channel);

    stubbed.restore();

    expect(result).to.equal(message);
  });

  it('should successful handle event', async () => {
    const eventName = 'sample.event';
    const eventParams = { sample: 'param', payload: { sender: 'demo', eventName } };
    const handler = sinon.stub();
    const stubbedAxios = sinon
      .stub(axios, 'request')
      // unknown event, just skip
      .onCall(0)
      .resolves({ data: {} })
      // unknown event worker error
      .onCall(1)
      .rejects({ message: 'unknown error' })
      // successful event
      .onCall(2)
      .resolves({ data: eventParams })
      // end
      .onCall(3)
      .rejects({ message: stopMsMessage });
    const clock = sinon.useFakeTimers();

    ms.addEventHandler(eventName, handler); // full match
    ms.addEventHandler('sample.*', handler); // partial match
    ms.addEventHandler('*', handler); // listen all events
    ms.addEventHandler('another.event.channel', handler);

    ms['options']['workers'] = 0; // temporary disable standard workers

    const start = ms.start();

    await clock.tickAsync(5000);
    await start;

    clock.restore();
    stubbedAxios.restore();
    ms['options']['workers'] = 1;

    const receivedParams = handler.firstCall.firstArg;

    expect(handler.getCalls().length).to.equal(3);
    expect(receivedParams).to.deep.equal(eventParams);
  });
});
