import { expect } from 'chai';
import type { Request } from 'express';
import sinon from 'sinon';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import ConsoleLogDriver from '@drivers/console-log';
import type {
  IEndpointHandler,
  IEndpointOptions,
} from '@interfaces/services/i-abstract-microservice';
import type { IRemoteMiddlewareEndpointParams } from '@interfaces/services/i-remote-middleware';
import { RemoteMiddlewareActionType } from '@interfaces/services/i-remote-middleware';
import Microservice from '@services/microservice';
import RemoteMiddleware from '@services/remote-middleware';

describe('services/remote-middleware', () => {
  const ms = Microservice.create();
  const service = new RemoteMiddleware(ms);

  let microserviceEndpointHandler: IEndpointHandler<IRemoteMiddlewareEndpointParams>;

  before(() => {
    sinon.stub(console, 'info');
  });

  after(() => {
    sinon.restore();
  });

  it('should correct set default log driver', () => {
    expect(service).to.have.property('logDriver').equal(ConsoleLogDriver);
  });

  it('should correct instantiate service without log driver', () => {
    const localService = new RemoteMiddleware(ms, { logDriver: false });
    const driver = localService['logDriver'];

    expect(driver).to.not.equal(ConsoleLogDriver);
    // noinspection JSVoidFunctionReturnValueUsed
    expect(driver(() => '')).to.undefined;
  });

  it('should throw error if method not pass', () => {
    // @ts-ignore
    expect(() => service.add()).to.throw();
  });

  it('should correct instantiate service with another endpoint', () => {
    const endpoint = 'another';
    const localService = new RemoteMiddleware(ms, { endpoint });

    expect(localService).to.property('endpoint').to.equal(endpoint);
  });

  it('should correct success execute remote middleware handler', async () => {
    const result = { middle: 'result' };
    const error = new BaseException({ message: 'Exception remove middleware' });
    const rmMethod = 'remote-method';
    const handler = service.add(rmMethod);
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
    const error = new BaseException({ message: 'Exception remove middleware' });
    const task = new MicroserviceRequest({ method: 'data' });
    const req = {} as Request;
    const handler = service.add('rm-method', {
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

      expect('was not supposed to succeed').to.throw();
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

  it('should correct remove middleware', () => {
    const method = 'test-remote';

    service.add(method);

    service.remove('unknown');
    service.remove(method);

    expect(service).to.property('methods').to.not.have.property(method);
  });

  it('should throw error if try register middleware twice', () => {
    const method = 'duplicate';

    service.add(method);

    expect(() => service.add(method)).to.throw();
  });

  it('should correct add remote middleware endpoint', () => {
    const spy = sinon.spy(ms, 'addEndpoint');

    service.addEndpoint();
    spy.restore();

    // eslint-disable-next-line prefer-destructuring
    microserviceEndpointHandler = spy.firstCall.args[1];

    expect(ms).to.property('endpoints').to.have.property('middlewares');
  });

  it('should correct works endpoint handler', async () => {
    const result = { ok: true };
    const error = { ok: false };
    const endpointOptions = { sender: 'hello' } as IEndpointOptions;

    const sandbox = sinon.createSandbox();

    const add = sandbox.stub(service, 'add');
    const remove = sandbox.stub(service, 'remove');

    const res1 = await microserviceEndpointHandler(
      {
        action: RemoteMiddlewareActionType.ADD,
        method: 'sample',
      },
      endpointOptions,
    );
    const res2 = await microserviceEndpointHandler(
      {
        action: RemoteMiddlewareActionType.REMOVE,
        method: 'sample',
      },
      endpointOptions,
    );
    // bad action
    const res3 = await microserviceEndpointHandler(
      {
        // @ts-ignore
        action: 'unknown',
        method: 'sample',
      },
      endpointOptions,
    );
    // bad sender
    const res4 = await microserviceEndpointHandler(
      {
        // @ts-ignore
        action: RemoteMiddlewareActionType.ADD,
        method: 'sample',
      },
      {} as IEndpointOptions,
    );

    sandbox.restore();

    expect(res1).to.deep.equal(result);
    expect(add).to.calledOnce;
    expect(res2).to.deep.equal(result);
    expect(remove).to.calledOnce;
    expect(res3).to.deep.equal(error);
    expect(res4).to.deep.equal(error);
  });

  it('should correct register/cancel remote middleware', async () => {
    const spy = sinon.stub(ms, 'sendRequest');
    const msName = 'remote-ms';
    const data = { action: RemoteMiddlewareActionType.ADD, method: 'example' };

    // register
    await service.registerRemote(msName, data);
    // cancel
    await service.registerRemote(msName, { ...data, action: RemoteMiddlewareActionType.REMOVE });
    // register without cancel
    await service.registerRemote(msName, data, { shouldCancelRegister: false });
    // try register with invalid action
    // @ts-ignore
    await service.registerRemote(msName, { ...data, action: 'unknown' });
    spy.restore();

    const [callMethod, callData] = spy.firstCall.args;

    expect(callMethod.startsWith(msName)).to.ok;
    expect(callData).to.deep.equal(data);
    expect(service).to.property('cancelMiddlewareMethods').to.deep.equal([]);
  });

  it('should correct register onExit callback', async () => {
    const spy = sinon.stub(ms, 'onExit');
    const spyReq = sinon.stub(ms, 'sendRequest').resolves();

    await service.registerRemote('some-name', {
      action: RemoteMiddlewareActionType.ADD,
      method: 'example',
    });
    service.registerOnExit();

    const handler = spy.firstCall.firstArg;

    await handler();

    spy.restore();
    spyReq.restore();

    expect(spy).to.calledOnce;
    /**
     * 1. Register middleware
     * 2. Cancel register (through onExit callback)
     */
    expect(spyReq).to.calledTwice;
  });
});
