import { expect } from 'chai';
import sinon from 'sinon';
import AbstractMicroservice from '@services/abstract-microservice';
import Microservice from '@services/microservice';

describe('services/microservice', () => {
  const ms = Microservice.create(undefined, { logDriver: false });

  before(() => {
    sinon.stub(console, 'info');
  });

  after(() => {
    sinon.restore();
  });

  it('should correct create microservice', () => {
    expect(ms).instanceof(Microservice);
    expect(ms).instanceof(AbstractMicroservice);
  });
});
