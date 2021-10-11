import axios from 'axios';
import { expect } from 'chai';
import { Response } from 'express';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { EXCEPTION_CODE } from '@constants/index';
import MicroserviceResponse from '@core/microservice-response';
import { MiddlewareHandler, MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import { IExpressRequest } from '@interfaces/services/i-gateway';
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
  const createRequest = (params: Record<string, any>) =>
    ({ body: { ...params }, headers: {} } as IExpressRequest);

  /**
   * Create express response
   */
  const createResponse = () =>
    ({ json: sinon.stub() } as unknown as Response & { json: SinonStub });

  before(() => {
    sinon.stub(console, 'info');
  });

  after(() => {
    sinon.restore();
  });

  it('should correct create gateway microservice', () => {
    expect(ms).instanceof(Gateway);
  });

  it('should create gateway microservice once', () => {
    expect(Gateway.create()).to.equal(ms);
  });

  it('should throw error if create gateway microservice through constructor', () => {
    // @ts-ignore
    expect(() => new Gateway()).to.throw();
  });

  it('should correct register microservice handler', () => {
    const msName = 'ms1';
    const msName2 = 'ms2';
    const msHandler = () => new MicroserviceResponse() as unknown as Promise<MicroserviceResponse>;

    ms.addMicroservice(msName, msHandler);
    ms.addMicroservice(msName2);

    expect(ms)
      .to.have.property('microservices')
      .deep.equal({ [msName]: msHandler, [msName2]: null });
  });

  it('should correct start gateway microservice', () => {
    const stubbed = sinon.stub(ms.getExpress(), 'listen');

    ms.start();
    stubbed.restore();

    const [port, host, funcLog] = stubbed.firstCall.args as unknown as [string, string, () => void];

    expect(port).to.equal(3000);
    expect(host).to.equal('0.0.0.0');
    expect(() => funcLog()).to.not.throw();
  });

  it('should return error "microservice not found"', async () => {
    const msName = 'noe-exist';
    const req = createRequest({ method: msName });
    const res = createResponse();

    await sendRequest(req, res);

    const response = res.json.firstCall.firstArg;

    expect(response).to.instanceof(MicroserviceResponse);
    expect(response.getError().toString().includes(`"${msName}" not found`)).to.ok;
  });

  it('should return handler error', async () => {
    const msName = 'demo';
    const errorMessage = 'Handler error';
    const req = createRequest({ method: msName });
    const res = createResponse();

    ms.addMicroservice(msName, () => {
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
    const msName = 'request-error';
    const errorMessage = 'Request error';
    const req = createRequest({ id: reqId, method: msName });
    const res = createResponse();

    ms.addMicroservice(msName);

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
    const msName = 'success-ms';
    const req = createRequest({ method: `${msName}.${endpointTriggerMiddleware}` });
    const res = createResponse();
    const responseAxios = new MicroserviceResponse({ result: { endpointTriggerMiddleware } });

    ms.addMiddleware(middlewareHandlerBefore);
    ms.addMiddleware(middlewareHandlerAfter, MiddlewareType.response);
    ms.addMicroservice(msName);

    const stubbed = sinon.stub(axios, 'request').resolves({ data: responseAxios.toJSON() });

    await sendRequest(req, res);
    stubbed.restore();

    const response = res.json.firstCall.firstArg;
    const { data } = stubbed.firstCall.firstArg;

    expect(response.getResult()).to.deep.equal({ endpointTriggerMiddleware, middleware: 'after' });
    expect(data.method).to.equal(endpointTriggerMiddleware);
    expect(data.params.middleware).to.equal('before');
  });
});
