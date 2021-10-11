import dns from 'dns';
import { expect } from 'chai';
import sinon from 'sinon';
import ConsoleLogDriver from '@drivers/console-log';
import { MiddlewareHandler, MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import Microservice from '@services/microservice';

describe('services/abstract-microservice', () => {
  const options = { name: 'tests', connection: 'http://my.local:8001', version: undefined };
  const ms = Microservice.create(options);

  // For test middlewares
  const middlewareHandlerBefore: MiddlewareHandler = () => undefined;
  const middlewareHandlerAfter: MiddlewareHandler = () => undefined;

  before(() => {
    sinon.stub(process, 'exit');
    sinon.stub(console, 'info');
  });

  after(() => {
    sinon.restore();
  });

  it('should correct set options', () => {
    expect(ms).to.have.property('options').property('name').equal(options.name);
    expect(ms).to.have.property('options').property('version').equal('1.0.0');
  });

  it('should correct set default log driver', () => {
    expect(ms).to.have.property('logDriver').equal(ConsoleLogDriver);
  });

  it('should correct instantiate microservice without log driver', () => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Microservice, 'instance' as any).value(undefined);

    const localMs = Microservice.create({}, { logDriver: false });
    const driver = localMs['logDriver'];

    expect(driver).not.equal(ConsoleLogDriver);
    // noinspection JSVoidFunctionReturnValueUsed
    expect(driver(() => '')).to.undefined;

    sandbox.restore();
  });

  it('should correct instantiate microservice with custom log driver', () => {
    const logDriver = () => ({ hello: 'world' });
    const sandbox = sinon.createSandbox();

    sandbox.stub(Microservice, 'instance' as any).value(undefined);

    const localMs = Microservice.create({}, { logDriver });

    expect(localMs).to.have.property('logDriver').equal(logDriver);

    sandbox.restore();
  });

  it('should correct add middleware handler', () => {
    ms.addMiddleware(middlewareHandlerBefore);
    ms.addMiddleware(middlewareHandlerAfter, MiddlewareType.response);

    expect(ms)
      .to.have.property('middlewares')
      .deep.equal({
        [MiddlewareType.request]: [middlewareHandlerBefore],
        [MiddlewareType.response]: [middlewareHandlerAfter],
      });
  });

  it('should correct add onExit handler', () => {
    const onExitHandler = sinon.spy(() => undefined);

    ms.onExit(onExitHandler);

    // @ts-ignore
    process.emit('SIGINT', 1);

    expect(onExitHandler).calledOnceWith(1);
  });

  it('should correct catch onExit handler error', () => {
    const onExitHandler = sinon.spy(() => {
      throw new Error('Hello');
    });

    ms.onExit(onExitHandler);

    // @ts-ignore
    process.emit('SIGINT', 1);

    expect(onExitHandler).to.throw();
  });

  it('should correct return connection string (SRV)', async () => {
    const srvHost = 'http://srv.local';

    const sandbox = sinon.createSandbox();

    sandbox.stub(ms, 'options' as any).value({ connection: srvHost, isSRV: true });
    const spy = sandbox
      .stub(dns, 'resolveSrv')
      .callsFake((domain, callback) =>
        callback(null, [{ priority: 1, weight: 1, name: 'srv.local', port: 8001 }]),
      );

    const connection = await ms.getConnection();

    // Test cache resolved srv
    await ms.getConnection();

    sandbox.restore();

    expect(connection).to.equal(`${srvHost}:8001`);
    expect(spy).to.callCount(1);
  });

  it('should correct return connection string (not SRV)', async () => {
    const connection = await ms.getConnection();

    expect(connection).to.equal(options.connection);
  });
});
