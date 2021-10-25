import axios from 'axios';
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

  it('should correct register microservice at gateway', async () => {
    const stubbed = sinon.stub(ms, 'sendRequest').resolves();
    const stubbedExit = sinon.stub(ms, 'onExit');
    const stubbedCancellation = sinon.stub(ms, 'gatewayRegisterCancel');

    await ms.gatewayRegister('gateway');

    stubbed.restore();
    stubbedExit.restore();

    const onExitCallback = stubbedExit.firstCall.firstArg;

    await onExitCallback();

    stubbedCancellation.restore();

    expect(stubbed).to.callCount(1);
    expect(stubbedExit).to.callCount(1);
    expect(stubbedCancellation).to.callCount(1);
  });

  it('should correct register microservice at gateway without cancellation', async () => {
    const stubbed = sinon.stub(ms, 'sendRequest').resolves();
    const stubbedExit = sinon.stub(ms, 'onExit');

    await ms.gatewayRegister('gateway', {
      shouldCancelRegister: false,
    });

    stubbed.restore();
    stubbedExit.restore();

    expect(stubbed).to.callCount(1);
    expect(stubbedExit).to.callCount(0);
  });

  it('should correct cancel microservice registration at gateway', async () => {
    const stubbed = sinon.stub(ms, 'sendRequest').resolves();

    await ms.gatewayRegisterCancel('gateway');
    await ms.gatewayRegisterCancel('gateway', false);

    stubbed.restore();

    const args = stubbed.firstCall.lastArg;
    const args2 = stubbed.secondCall.lastArg;

    expect(stubbed).to.callCount(2);
    expect(args.reqParams.headers).to.include({ type: 'async' });
    expect(args2.reqParams.headers).to.not.include({ type: 'async' });
  });

  it('should throw register remote middleware - before/after', () => {
    expect(() => ms.addEndpointMiddlewareBefore('a', () => ({}))).to.throw();
    expect(() => ms.addEndpointMiddlewareBefore('a', () => ({}), '')).to.throw();

    expect(() => ms.addEndpointMiddlewareAfter('a', () => ({}))).to.throw();
    expect(() => ms.addEndpointMiddlewareAfter('a', () => ({}), '')).to.throw();
  });

  it('should correct register remote middleware - before/after', async () => {
    const sandbox = sinon.createSandbox();
    const stubbedEndpoint = sandbox.stub(ms, 'addEndpoint');
    const stubbedRemote = sandbox.stub(ms.getRemoteMiddlewareService(), 'registerRemote');

    await ms.addEndpointMiddlewareBefore('world', () => ({}), 'micro');
    await ms.addEndpointMiddlewareAfter('world', () => ({}), 'micro');

    sandbox.restore();

    expect(stubbedEndpoint).to.calledTwice;
    expect(stubbedRemote).to.calledTwice;
  });

  it('should correct start microservice with auto registration at gateway', async () => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Microservice, 'instance' as any).value(undefined);

    const localMs = Microservice.create({ autoRegistrationGateway: 'gateway' });

    const spy = sandbox.spy(localMs, 'gatewayRegister');

    sinon.stub(axios, 'request').rejects(new Error('ECONNREFUSED'));
    // @ts-ignore
    sandbox.stub(localMs, 'startWorkers').resolves({});

    await localMs.start();

    sandbox.restore();

    expect(spy).to.calledOnce;
  });
});
