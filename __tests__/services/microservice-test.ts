import { expect } from 'chai';
import AbstractMicroservice from '@services/abstract-microservice';
import Microservice from '@services/microservice';

describe('services/microservice', () => {
  const ms = Microservice.create();

  it('should correct create microservice', () => {
    expect(ms).instanceof(Microservice);
    expect(ms).instanceof(AbstractMicroservice);
  });
});
