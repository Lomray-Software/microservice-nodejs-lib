import { Server } from 'http';
import axios from 'axios';
import { expect } from 'chai';
import { Response } from 'express';
import _ from 'lodash';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { EXCEPTION_CODE } from '@constants/index';
import MicroserviceResponse from '@core/microservice-response';
import {
  IEndpointOptions,
  MiddlewareHandler,
  MiddlewareType,
} from '@interfaces/services/i-abstract-microservice';
import { AutoRegistrationAction, IExpressRequest } from '@interfaces/services/i-gateway';
import AbstractMicroservice from '@services/abstract-microservice';
import Gateway from '@services/gateway';

describe('services/gateway', () => {
  const ms = Gateway.create();
  const sendRequest = ms['handleClientRequest'].bind(ms);

  // For test middlewares
  const endpointTriggerMiddleware = 'middleware-endpoint';
  const middlewareHandlerBefore: MiddlewareHandler = ({ task }) =>
    (task.getMethod().includes(endpointTriggerMiddleware) && {
      ...task.getParams(),
      middleware: 'before',
    }) ||
    undefined;
  const middlewareHandlerAfter: MiddlewareHandler = ({ task, result }) =>
    (task.getMethod().includes(endpointTriggerMiddleware) && { ...result, middleware: 'after' }) ||
    undefined;

  /**
   * Create express request
   */
  const createRequest = (body?: Record<string, any>, headers?: Record<string, any>) =>
    ({ body, headers } as IExpressRequest);

  /**
   * Create express response
   */
  const createResponse = () =>
    ({ json: sinon.stub() } as unknown as Response & { json: SinonStub });

  const msName = 'ms1';
  const msName2 = 'ms2';
  const msHandler = () => new MicroserviceResponse() as unknown as Promise<MicroserviceResponse>;

  before(() => {
    sinon.stub(console, 'info');
  });

  after(() => {
    sinon.restore();
  });

  it('should correct create gateway microservice', () => {
    expect(ms).instanceof(Gateway);
    expect(ms).instanceof(AbstractMicroservice);
  });

  it('should create gateway microservice once', () => {
    expect(Gateway.create()).to.equal(ms);
  });

  it('should throw error if create gateway microservice through constructor', () => {
    // @ts-ignore
    expect(() => new Gateway()).to.throw();
  });

  it('should correct response info route', () => {
    const infoRoute = _.findLast(ms.getExpress()._router.stack, {
      route: { path: '/', methods: { get: true } },
    });
    const res = { send: sinon.stub() };

    infoRoute.handle({ method: 'get' }, res);

    expect(res.send.firstCall.firstArg.includes('gateway')).to.ok;
  });

  it('should correct instantiate microservice without info route', () => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Gateway, 'instance' as any).value(undefined);

    const localMs = Gateway.create({ infoRoute: null });

    sandbox.restore();

    const infoRoute = _.findLast(localMs.getExpress()._router.stack, {
      route: { path: '/', methods: { get: true } },
    });

    expect(infoRoute).to.undefined;
  });

  it('should correct add auto registration endpoint', () => {
    expect(ms).to.property('endpoints').have.property('register-microservice');
  });

  it('should correct instantiate microservice without auto registration endpoint', () => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Gateway, 'instance' as any).value(undefined);

    const localMs = Gateway.create({ hasAutoRegistrationEndpoint: false });

    sandbox.restore();

    expect(localMs).to.property('endpoints').not.have.property('register-microservice');
  });

  it('should correct register microservice handler', () => {
    ms.addMicroservice(msName, msHandler);
    ms.addMicroservice(msName2);

    expect(ms)
      .to.have.property('microservices')
      .deep.equal({ [msName]: msHandler, [msName2]: null });
  });

  it('should correct remove microservice handler', () => {
    ms.removeMicroservice(msName);

    expect(ms)
      .to.have.property('microservices')
      .deep.equal({ [msName2]: null });
  });

  describe('addAutoRegistrationEndpoint', () => {
    const { handler } = ms['endpoints'][ms['autoRegistrationEndpoint']];
    const sender = 'test';

    it('should correct auto register microservice', async () => {
      await handler({ action: AutoRegistrationAction.ADD }, { sender } as IEndpointOptions);

      expect(ms).to.property('microservices').have.property(sender);
    });

    it('should throw errors if incorrect try auto register microservice', () => {
      expect(() => handler({ action: 'unknown' }, { sender } as IEndpointOptions)).to.throw();
      expect(() =>
        handler({ action: AutoRegistrationAction.REMOVE }, { sender: '' } as IEndpointOptions),
      ).to.throw();
    });

    it('should correct auto cancel microservice registration', async () => {
      await handler({ action: AutoRegistrationAction.REMOVE }, { sender } as IEndpointOptions);

      expect(ms).to.property('microservices').not.have.property(sender);
    });
  });

  it('should return express error response', () => {
    const service = 'example';
    const req = { service } as unknown as IExpressRequest;
    const res = createResponse();
    const name = 'error-name';
    const message = 'error-message';
    const next = sinon.stub();
    const handleException = Gateway['expressError'];

    const case1 = { status: 1, code: 2, service: 'hi' };
    const case2 = { statusCode: 10 };

    handleException({ ...case1, message, name }, req, res, next);
    handleException({ ...case2, message, name }, req, res, next);
    handleException({ message, name }, req, res, next);

    const result1 = res.json.getCall(0).firstArg;
    const result2 = res.json.getCall(1).firstArg;
    const result3 = res.json.getCall(1).firstArg;

    expect(result1).to.instanceof(MicroserviceResponse);
    expect(result1.getError().toJSON().status).to.equal(case1.status);
    expect(result1.getError().toJSON().service).to.equal(case1.service);
    expect(result2.getError().toJSON().status).to.equal(case2.statusCode);
    expect(result3.getError().toJSON().service).to.equal(service);
  });

  it('should correct start gateway microservice', async () => {
    const stubbed = sinon
      .stub(ms.getExpress(), 'listen')
      .returns({ close: sinon.stub() } as unknown as Server);

    await ms.start();
    stubbed.restore();

    const [port, host, funcLog] = stubbed.firstCall.args as unknown as [string, string, () => void];

    expect(port).to.equal(3000);
    expect(host).to.equal('0.0.0.0');
    expect(() => funcLog()).to.not.throw();
  });

  it('should return invalid body error', async () => {
    const req = createRequest();
    const res = createResponse();

    await sendRequest(req, res);

    const response = res.json.firstCall.firstArg;

    expect(response.getError().toJSON().message.startsWith('Invalid JSON')).to.ok;
  });

  it('should return invalid JSON-RPC request', async () => {
    const res = createResponse();

    // Invalid id
    await sendRequest(createRequest({ id: {}, method: 'normal' }), res);
    // Invalid method
    await sendRequest(createRequest({ id: '123', method: {} }), res);
    // Invalid params
    await sendRequest(createRequest({ id: 1, method: 'normal', params: '' }), res);
    await sendRequest(createRequest({ id: 1, method: 'normal', params: [] }), res);

    const result1 = res.json.firstCall.firstArg;
    const result2 = res.json.secondCall.firstArg;
    const result3 = res.json.thirdCall.firstArg;
    const result4 = res.json.getCall(3).firstArg;

    expect(result1.getError().toJSON().code).to.equal(EXCEPTION_CODE.INVALID_REQUEST);
    expect(result2.getError().toJSON().code).to.equal(EXCEPTION_CODE.INVALID_REQUEST);
    expect(result3.getError().toJSON().code).to.equal(EXCEPTION_CODE.INVALID_PARAMS);
    expect(result4.getError().toJSON().code).to.equal(EXCEPTION_CODE.INVALID_PARAMS);
  });

  it('should return error "microservice not found"', async () => {
    const msNameMethod = 'not-exist';
    const req = createRequest({ method: msNameMethod });
    const res = createResponse();

    await sendRequest(req, res);

    const response = res.json.firstCall.firstArg;

    expect(response).to.instanceof(MicroserviceResponse);
    expect(response.getError().toString().includes(`"${msNameMethod}" not found`)).to.ok;
  });

  it('should return handler error', async () => {
    const msNameMethod = 'demo';
    const errorMessage = 'Handler error';
    const req = createRequest({ method: msNameMethod });
    const res = createResponse();

    ms.addMicroservice(msNameMethod, () => {
      throw new Error(errorMessage);
    });

    await sendRequest(req, res);

    const response = res.json.firstCall.firstArg;
    const errorFields = response.getError().toJSON();

    expect(response).to.instanceof(MicroserviceResponse);
    expect(errorFields.code).to.equal(EXCEPTION_CODE.GATEWAY_HANDLER_EXCEPTION);
    expect(errorFields.message.includes(errorMessage)).to.ok;
  });

  it('should return request error & pass reqId', async () => {
    const reqId = 999;
    const msNameMethod = 'request-error';
    const errorMessage = 'Request error';
    const req = createRequest({ id: reqId, method: msNameMethod });
    const res = createResponse();

    ms.addMicroservice(msNameMethod);

    const stubbed = sinon.stub(axios, 'request').rejects(new Error(errorMessage));

    // @ts-ignore
    await sendRequest(req, res);
    stubbed.restore();

    const response = res.json.firstCall.firstArg;
    const errorFields = response.getError().toJSON();

    expect(response).to.instanceof(MicroserviceResponse);
    expect(errorFields.message).to.equal(errorMessage);
    expect(response.getId()).to.equal(reqId);
  });

  it('should return request success response', async () => {
    const msNameMethod = 'success-ms';
    const req = createRequest(
      { method: `${msNameMethod}.${endpointTriggerMiddleware}` },
      { type: 'async' },
    );
    const res = createResponse();
    const responseAxios = new MicroserviceResponse({ result: { endpointTriggerMiddleware } });

    ms.addMiddleware(middlewareHandlerBefore);
    ms.addMiddleware(middlewareHandlerAfter, MiddlewareType.response);
    ms.addMicroservice(msNameMethod);

    const stubbed = sinon.stub(axios, 'request').resolves({ data: responseAxios.toJSON() });

    await sendRequest(req, res);
    stubbed.restore();

    const response = res.json.firstCall.firstArg;
    const { data, headers } = stubbed.firstCall.firstArg;

    expect(response.getResult()).to.deep.equal({ endpointTriggerMiddleware, middleware: 'after' });
    expect(data.method).to.equal(endpointTriggerMiddleware);
    expect(data.params.middleware).to.equal('before');
    expect(headers.type).to.equal('async');
  });
});
