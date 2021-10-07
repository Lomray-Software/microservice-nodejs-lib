import { expect } from 'chai';
import BaseException from '@core/base-exception';

describe('core/base-exception', () => {
  const exceptionProps = {
    code: 999,
    status: 404,
    service: 'example',
    message: 'Critically error!!!',
    payload: { hello: 'world' },
  };
  const exception = new BaseException(exceptionProps);

  it('should correct instantiate exception', () => {
    expect(exception).to.instanceof(BaseException);
  });

  it('should correct set exception properties', () => {
    expect(exception.toJSON()).to.deep.equal(exceptionProps);
  });

  it('should correct return exception like string', () => {
    expect(exception.toString().startsWith(`Error: ${exceptionProps.message}`)).to.ok;
  });
});
