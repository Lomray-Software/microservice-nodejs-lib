import { expect } from 'chai';
import Singleton from '@patterns/singleton';

describe('patterns/singleton', () => {
  const instance = Singleton.getInstance();

  it('should correct create new instance', () => {
    expect(instance).instanceof(Singleton);
  });

  it('should correct get the same instance', () => {
    expect(instance).equal(Singleton.getInstance());
  });

  it('should throw exception if create via constructor', () => {
    // @ts-ignore
    expect(() => new Singleton() as Singleton).to.throw;
  });
});
