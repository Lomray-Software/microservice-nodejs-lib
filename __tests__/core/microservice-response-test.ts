import { expect } from 'chai';
import BaseException from '@core/base-exception';
import MicroserviceResponse from '@core/microservice-response';

describe('core/microservice-response', () => {
  const resParams = {
    id: 1,
    result: { payload: 1 },
  };
  const response = new MicroserviceResponse(resParams);

  const json = { jsonrpc: '2.0', ...resParams };

  it('should correct instantiate microservice response', () => {
    expect(response).to.instanceof(MicroserviceResponse);
  });

  it('should correct set response params & return like JSON', () => {
    expect(response.toJSON()).to.deep.equal(json);
  });

  it('should correct return response like string', () => {
    expect(response.toString()).to.equal(JSON.stringify(json));
  });

  it('should correct return response identity', () => {
    expect(response.getId()).to.equal(resParams.id);
  });

  it('should correct return response result', () => {
    expect(response.getResult()).to.equal(resParams.result);
  });

  it('should correct set response result', () => {
    const result = { hi: 'result' };
    const res = new MicroserviceResponse({ id: 1 });

    res.setResult(result);

    expect(res.getResult()).to.deep.equal(result);
  });

  it('should correct set response error', () => {
    const error = new BaseException({ message: 'Test exception' });
    const res = new MicroserviceResponse({ id: 1 });

    res.setError(error);

    expect(res.getError()).to.deep.equal(error);
  });

  it('should correct return response error', () => {
    const params = {
      id: 1,
      error: new BaseException({ message: 'Critical' }),
    };
    const res = new MicroserviceResponse(params);

    expect(res.getError()).to.deep.equal(params.error);
  });

  it('should correct instantiate without "id", "result", "error"', () => {
    const res = new MicroserviceResponse({});

    expect(res.toJSON()).to.equal(undefined);
  });
});
