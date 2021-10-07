import dns from 'dns';
import { expect } from 'chai';
import sinon from 'sinon';
import ResolveSrv from '@helpers/resolve-srv';

describe('helpers/resolve-srv', () => {
  const srvRecord = 'example.local';

  let mockedError: Error | null = null;
  let mockedAddresses = [
    { priority: 1, weight: 1, name: 'example.com', port: 8001 },
    { priority: 1, weight: 2, name: 'example.com', port: 8002 },
  ];

  before(() => {
    sinon
      .stub(dns, 'resolveSrv')
      .callsFake((domain, callback) => callback(mockedError, mockedAddresses));
  });

  after(() => {
    sinon.restore();
  });

  it('should correct resolve srv record without protocol', async () => {
    const result = await ResolveSrv(srvRecord);

    expect(result).to.equal('example.com:8002');
  });

  it('should correct resolve srv record with protocol', async () => {
    const result = await ResolveSrv('https://example.local');

    expect(result).to.equal('https://example.com:8002');
  });

  it('should throw empty list error', async () => {
    mockedAddresses = [];

    try {
      await ResolveSrv(srvRecord);

      expect('was not supposed to succeed').to.throw();
    } catch (e) {
      expect(e).to.include('empty list');
    }
  });

  it('should throw native exception', async () => {
    const errorMsg = 'Native error';

    mockedError = new Error(errorMsg);

    try {
      await ResolveSrv(srvRecord);

      expect('was not supposed to succeed').to.throw();
    } catch (e) {
      expect(e.message).to.equal(errorMsg);
    }
  });
});
