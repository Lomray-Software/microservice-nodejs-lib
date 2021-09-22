import * as assert from 'assert';
import Microservice from '@services/microservice';

describe('services/microservice', () => {
  it('should throw exception if create via constructor', () => {
    console.log(Microservice);
    assert.equal(1, 2);
  });
});
