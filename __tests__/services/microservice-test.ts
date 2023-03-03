import { expect } from 'chai';
import sinon from 'sinon';
import AbstractMicroservice from '@services/abstract-microservice';
import Microservice from '@services/microservice';

describe('services/microservice', () => {
  const ms = Microservice.create(undefined, { logDriver: false });

  after(() => {
    sinon.restore();
  });

  it('should correct create microservice', () => {
    expect(ms).instanceof(Microservice);
    expect(ms).instanceof(AbstractMicroservice);
  });

  it('should correct get microservice instance', () => {
    expect(Microservice.getInstance()).to.equal(ms);
  });
});
