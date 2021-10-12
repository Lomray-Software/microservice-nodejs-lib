import dns from 'dns';
import { expect } from 'chai';
import type { Request } from 'express';
import sinon from 'sinon';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import ConsoleLogDriver from '@drivers/console-log';
import { MiddlewareHandler, MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import Microservice from '@services/microservice';

describe('services/abstract-microservice', () => {
  const options = { name: 'tests', connection: 'http://my.local:8001', version: undefined };
  const ms = Microservice.create(options);

  // For test middlewares
  const middlewareHandlerBefore: MiddlewareHandler = () => undefined;
  const middlewareHandlerAfter: MiddlewareHandler = () => undefined;

  before(() => {
    sinon.stub(process, 'exit');
    sinon.stub(console, 'info');
  });

  after(() => {
    sinon.restore();
  });

  it('should correct set options', () => {
    expect(ms).to.have.property('options').property('name').equal(options.name);
    expect(ms).to.have.property('options').property('version').equal('1.0.0');
  });

  it('should correct set default log driver', () => {
    expect(ms).to.have.property('logDriver').equal(ConsoleLogDriver);
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

  it('should correct remove middleware handler', () => {
    ms.removeMiddleware(middlewareHandlerBefore);
    ms.removeMiddleware(() => undefined);

    expect(ms)
      .to.have.property('middlewares')
      .deep.equal({
        [MiddlewareType.request]: [],
        [MiddlewareType.response]: [middlewareHandlerAfter],
      });
  });

  it('should correct success execute remote middleware handler', async () => {
    const result = { middle: 'result' };
    const error = new BaseException({ message: 'Exception remove middleware' });
    const rmMethod = 'remote-method';
    const handler = ms.addRemoteMiddleware(rmMethod);
    const task = new MicroserviceRequest({ method: 'data' });
    const req = { headers: { test: 1 }, statusCode: 2 } as unknown as Request;

    const stubbed = sinon
      .stub(ms, 'sendRequest')
      .onCall(0)
      .resolves(new MicroserviceResponse({ result }))
      .onCall(1)
      .resolves(new MicroserviceResponse({ error }))
      .onCall(2)
      .rejects(error);

    const response = await handler({ task }, req);
    const response2 = await handler({ task }, req);
    const response3 = await handler({ task }, req);

    ms.removeMiddleware(handler);
    stubbed.restore();

    const [method, data] = stubbed.firstCall.args;

    expect(response).to.deep.equal(result);
    expect(response2).to.undefined; // middleware silently error
    expect(response3).to.undefined; // middleware silently error (catch)
    expect(method).to.equal(rmMethod);
    expect(data).to.deep.equal({ task, req });
  });

  it('should throw error remote middleware handler', async () => {
    const notSupposedMessage = 'was not supposed to succeed';
    const error = new BaseException({ message: 'Exception remove middleware' });
    const task = new MicroserviceRequest({ method: 'data' });
    const req = {} as Request;
    const handler = ms.addRemoteMiddleware('rm-method', {
      isRequired: true,
    });

    const stubbed = sinon
      .stub(ms, 'sendRequest')
      .onCall(0)
      .resolves(new MicroserviceResponse({ error }))
      .onCall(1)
      .rejects(error);

    try {
      await handler({ task }, req);

      expect(notSupposedMessage).to.throw();
    } catch (e) {
      expect(e).to.instanceof(BaseException);
    }

    try {
      await handler({ task }, req);
    } catch (e) {
      expect(e).to.instanceof(BaseException);
    }

    ms.removeMiddleware(handler);
    stubbed.restore();
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
});
