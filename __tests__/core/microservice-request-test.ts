import { expect } from 'chai';
import MicroserviceRequest from '@core/microservice-request';

describe('core/microservice-request', () => {
  const reqParams = {
    id: 1,
    method: 'example',
    params: { hello: 'world' },
  };
  const request = new MicroserviceRequest(reqParams);

  const json = { jsonrpc: '2.0', ...reqParams };

  it('should correct instantiate microservice request', () => {
    expect(request).to.instanceof(MicroserviceRequest);
  });

  it('should correct set request params & return like JSON', () => {
    expect(request.toJSON()).to.deep.equal(json);
  });

  it('should correct return request like string', () => {
    expect(request.toString()).to.equal(JSON.stringify(json));
  });

  it('should correct return request identity', () => {
    expect(request.getId()).to.equal(reqParams.id);
  });

  it('should correct return request method', () => {
    expect(request.getMethod()).to.equal(reqParams.method);
  });

  it('should correct return request params', () => {
    expect(request.getParams()).to.deep.equal(reqParams.params);
  });

  it('should correct instantiate without "id" and "params"', () => {
    const params = { method: reqParams.method };
    const req = new MicroserviceRequest(params);

    expect(req.toJSON()).to.deep.equal({ jsonrpc: '2.0', ...params });
  });
});
