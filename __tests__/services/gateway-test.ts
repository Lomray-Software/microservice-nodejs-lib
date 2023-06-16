import type { Server } from 'http';
import axios from 'axios';
import { expect } from 'chai';
import type { Response } from 'express';
import _ from 'lodash';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { EXCEPTION_CODE } from '@constants/index';
import MicroserviceResponse from '@core/microservice-response';
import { CookiesAction } from '@interfaces/core/i-microservice-response';
import type { MiddlewareHandler } from '@interfaces/services/i-abstract-microservice';
import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import type { IExpressRequest } from '@interfaces/services/i-gateway';
import AbstractMicroservice from '@services/abstract-microservice';
import Gateway from '@services/gateway';

describe('services/gateway', () => {
  const ms = Gateway.create();
  const handleClientRequest = ms['handleClientRequest'].bind(ms);

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
    ({
      json: sinon.stub(),
      cookie: sinon.stub(),
      clearCookie: sinon.stub(),
      status: sinon.stub(),
    } as unknown as Response & { json: SinonStub; cookie: SinonStub; clearCookie: SinonStub });

  const msName = 'ms1';
  const msName2 = 'ms2';
  const msHandler = () => new MicroserviceResponse() as unknown as Promise<MicroserviceResponse>;

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

  it('should correct get microservice instance', () => {
    expect(Gateway.getInstance()).to.equal(ms);
  });

  it('should throw error if create gateway microservice through constructor', () => {
    // @ts-ignore
    expect(() => new Gateway()).to.throw();
  });

  it('should correct start microservice without info route & after/before middlewares', async () => {
    const sandbox = sinon.createSandbox();
    const beforeRoute = sinon.spy();
    const afterRoute = sinon.spy();

    sandbox.stub(Gateway, 'instance' as never).value(undefined);

    const localMs = Gateway.create({ infoRoute: null }, { beforeRoute, afterRoute });
    const getStub = sinon.stub();

    sandbox
      .stub(localMs.getExpress(), 'listen')
      .returns({ close: sinon.stub(), get: getStub } as unknown as Server);
    sandbox.stub(axios, 'request').rejects(new Error('ECONNREFUSED'));
    sandbox.stub(Gateway, 'instance' as any).value(undefined);

    await localMs.start();

    sandbox.restore();

    expect(getStub).to.not.called;
    expect(beforeRoute).to.calledWith(localMs.getExpress());
    expect(afterRoute).to.calledWith(localMs.getExpress());
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

  it('should return express error response', () => {
    const service = 'example';
    const req = { service } as unknown as IExpressRequest;
    const req2 = { service, forceStatus: true } as unknown as IExpressRequest;
    const res = createResponse();
    const name = 'error-name';
    const message = 'error-message';
    const next = sinon.stub();
    const handleException = Gateway['expressError'];

    const case1 = { status: 1, code: 2, service: 'hi' };
    const case2 = { statusCode: 10 };
    const case3 = { status: 501 };

    handleException({ ...case1, message, name }, req, res, next);
    handleException({ ...case2, message, name }, req, res, next);
    handleException({ ...case3, message, name }, req2, res, next);
    handleException({ message, name }, req, res, next);

    const result1 = res.json.getCall(0).firstArg;
    const result2 = res.json.getCall(1).firstArg;
    const result3 = res.json.getCall(1).firstArg;

    expect(result1).to.instanceof(MicroserviceResponse);
    expect(result1.getError().toJSON().status).to.equal(case1.status);
    expect(result1.getError().toJSON().service).to.equal(case1.service);
    expect(result2.getError().toJSON().status).to.equal(case2.statusCode);
    expect(result3.getError().toJSON().service).to.equal(service);
    expect(res['status']).to.calledOnceWith(501);
    expect(res['json']).to.callCount(4);
  });

  it('should correct start gateway microservice', async () => {
    const stubbed = sinon
      .stub(ms.getExpress(), 'listen')
      .returns({ close: sinon.stub() } as unknown as Server);
    // Skip startWorkers
    const stubbedAxios = sinon.stub(axios, 'request').rejects(new Error('ECONNREFUSED'));

    await ms.start();
    stubbed.restore();
    stubbedAxios.restore();

    const [port, host, funcLog] = stubbed.firstCall.args as unknown as [string, string, () => void];

    expect(port).to.equal(3000);
    expect(host).to.equal('0.0.0.0');
    expect(() => funcLog()).to.not.throw();
  });

  it('should correct response info route', () => {
    const infoRoute = _.findLast(ms.getExpress()._router.stack, {
      route: { path: '/', methods: { get: true } },
    });
    const res = { send: sinon.stub() };

    infoRoute.handle({ method: 'get' }, res);

    expect(res.send.firstCall.firstArg.includes('gateway')).to.ok;
  });

  it('should return parse json error', async () => {
    const req = createRequest();
    const res = createResponse();

    await handleClientRequest(req, res);

    const response = res.json.firstCall.firstArg;

    expect(response.getError().toJSON().message.startsWith('Request parse error')).to.ok;
  });

  it('should return invalid JSON-RPC request', async () => {
    const res = createResponse();

    // Invalid id
    await handleClientRequest(createRequest({ id: {}, method: 'normal' }), res);
    // Invalid method
    await handleClientRequest(createRequest({ id: '123', method: {} }), res);
    // Invalid params
    await handleClientRequest(createRequest({ id: 1, method: 'normal', params: '' }), res);
    await handleClientRequest(createRequest({ id: 1, method: 'normal', params: [] }), res);

    const result1 = res.json.firstCall.firstArg;
    const result2 = res.json.secondCall.firstArg;
    const result3 = res.json.thirdCall.firstArg;
    const result4 = res.json.getCall(3).firstArg;

    expect(result1.getError().toJSON().code).to.equal(EXCEPTION_CODE.INVALID_REQUEST);
    expect(result2.getError().toJSON().code).to.equal(EXCEPTION_CODE.INVALID_REQUEST);
    expect(result3.getError().toJSON().code).to.equal(EXCEPTION_CODE.INVALID_PARAMS);
    expect(result4.getError().toJSON().code).to.equal(EXCEPTION_CODE.INVALID_PARAMS);
  });

  it('should return error "microservice not found" (auto registration)', async () => {
    const msNameMethod = 'not-exist';
    const req = createRequest({ method: msNameMethod });
    const res = createResponse();

    const stubbed = sinon.stub(axios, 'request').resolves({ data: null });

    await handleClientRequest(req, res);

    stubbed.restore();

    const response = res.json.firstCall.firstArg;

    expect(response).to.instanceof(MicroserviceResponse);
    expect(response.getError().toString().includes(`"${msNameMethod}" not found`)).to.ok;
  });

  it('should return error "microservice not found" (auto registration disabled)', async () => {
    const sandbox = sinon.createSandbox();
    const msNameMethod = 'not-exist';
    const req = createRequest({ method: msNameMethod });
    const res = createResponse();

    sandbox.stub(Gateway, 'instance' as any).value(undefined);

    const localMs = Gateway.create({ hasAutoRegistration: false });
    const handleClientRequestLocal = localMs['handleClientRequest'].bind(localMs);

    await handleClientRequestLocal(req, res);

    sandbox.restore();

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

    await handleClientRequest(req, res);

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
    await handleClientRequest(req, res);
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

    await handleClientRequest(req, res);
    stubbed.restore();

    const response = res.json.firstCall.firstArg;
    const { data, headers } = stubbed.firstCall.firstArg;

    expect(response.getResult()).to.deep.equal({ endpointTriggerMiddleware, middleware: 'after' });
    expect(data.method).to.equal(endpointTriggerMiddleware);
    expect(data.params.middleware).to.equal('before');
    expect(data.params.payload.headers.type).to.equal('async'); // check pass client headers through payload
    expect(headers.type).to.equal('async');
  });

  it('should return invalid request - empty (batch)', async () => {
    const req = createRequest([]);
    const res = createResponse();

    await handleClientRequest(req, res);

    const response = res.json.firstCall.firstArg;

    expect(response.getError().toJSON().message.startsWith('Invalid Request')).to.ok;
  });

  it('should return invalid request - limit exceeded (batch)', async () => {
    const req = createRequest([{}, {}, {}, {}, {}, {}]); // limit is 5 by default
    const res = createResponse();

    await handleClientRequest(req, res);

    const response = res.json.firstCall.firstArg;

    expect(response.getError().toJSON().message.includes('limit exceeded')).to.ok;
  });

  it('should return invalid request - some (batch)', async () => {
    const req = createRequest([{}, null, {}]);
    const res = createResponse();

    await handleClientRequest(req, res);

    const response = res.json.firstCall.firstArg;

    expect(response.getError().toJSON().message.startsWith('Batch contains')).to.ok;
  });

  it('should return correct response (batch)', async () => {
    const req = createRequest([{ method: 'success-ms.test' }]);
    const res = createResponse();

    const responseAxios = new MicroserviceResponse({ result: { hello: 'world' } });
    const stubbed = sinon.stub(axios, 'request').resolves({ data: responseAxios.toJSON() });

    await handleClientRequest(req, res);

    stubbed.restore();

    const response = res.json.firstCall.firstArg;

    expect(response.length).to.equal(1);
    expect(response[0].getResult()).to.deep.equal(responseAxios.getResult());
  });

  it('should return correct response - async (batch)', async () => {
    const req = createRequest([{ method: 'success-ms.test' }], { type: 'async' });
    const res = createResponse();

    const responseAxios = new MicroserviceResponse({ result: { hello: 'world' } });
    const stubbed = sinon.stub(axios, 'request').resolves({ data: responseAxios.toJSON() });

    await handleClientRequest(req, res);

    stubbed.restore();

    const response = res.json.firstCall.firstArg;

    expect(response).to.undefined;
    expect(stubbed).to.calledOnce;
  });

  it('should correctly manipulation with cookie', async () => {
    const req = createRequest({ method: 'cookies.test-cookies' });
    const res = createResponse();

    const responseAxios = new MicroserviceResponse({
      result: {
        hello: 'world',
        payload: {
          cookies: [
            {
              action: CookiesAction.add,
              name: 'cookie1',
              value: 'test1',
              options: { httpOnly: true },
            },
            { action: CookiesAction.remove, name: 'cookie2', options: { domain: 'test' } },
          ],
        },
      },
    });
    const stubbed = sinon.stub(axios, 'request').resolves({ data: responseAxios.toJSON() });

    await handleClientRequest(req, res);

    stubbed.restore();

    const addCookie = res.cookie.firstCall.args;
    const clearCookie = res.clearCookie.firstCall.args;
    const result = res.json.firstCall.firstArg;

    expect(addCookie).to.deep.equal(['cookie1', 'test1', { httpOnly: true }]);
    expect(clearCookie).to.deep.equal([
      'cookie2',
      {
        domain: 'test',
      },
    ]);
    expect(result.payload).to.undefined;
  });
});
