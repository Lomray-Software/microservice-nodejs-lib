import http from 'http';
import axios from 'axios';
import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import type { BroadcastOperator, Socket as IoSocket } from 'socket.io';
import { Server as ServerSocketIO } from 'socket.io';
import { EXCEPTION_CODE } from '@constants/index';
import BaseException from '@core/base-exception';
import MicroserviceResponse from '@core/microservice-response';
import type { MiddlewareHandler } from '@interfaces/services/i-abstract-microservice';
import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import type { IClientToServerEvents } from '@interfaces/services/i-socket';
import AbstractMicroservice from '@services/abstract-microservice';
import Socket from '@services/socket';

describe('services/socket', () => {
  const sandbox = sinon.createSandbox();
  const ioServerOptions = { path: '/socket' };
  const ms = Socket.create(
    { eventWorkers: 1 },
    { ioServerOptions, signRoomOptions: { secretKey: 'test' } },
  );

  const method1 = 'test.method.1';
  const method2 = 'test.method.2';
  const method3 = 'test.method.3';
  const handler = () => ['room-name'];
  const entity = { id: 'entity-id', title: 'Hi' };

  const middlewareHandlerBefore: MiddlewareHandler = ({ task }) => ({
    ...task.getParams(),
    middleware1: 'before',
    payload: { hello: 'world' },
  });
  const middlewareHandlerAfter: MiddlewareHandler = ({ result }) => ({
    ...result,
    middleware2: 'after',
  });

  afterEach(() => {
    ms.removeMiddleware(middlewareHandlerAfter);
    ms.removeMiddleware(middlewareHandlerBefore);
    sandbox.restore();
  });

  it('should correctly create socket microservice', () => {
    expect(ms).instanceof(Socket);
    expect(ms).instanceof(AbstractMicroservice);
  });

  it('should create socket microservice once', () => {
    expect(Socket.create()).to.equal(ms);
  });

  it('should correctly get microservice instance', () => {
    expect(Socket.getInstance()).to.equal(ms);
  });

  it('should throw error if create socket microservice through constructor', () => {
    // @ts-ignore
    expect(() => new Socket()).to.throw();
  });

  it('should correctly return socket server instance', () => {
    expect(ms.getIoServer()).to.instanceof(ServerSocketIO);
  });

  it('should correctly return http server instance', () => {
    expect(ms.getHttpServer()).to.instanceof(http.Server);
  });

  it('should correctly add room name handlers', () => {
    ms.addRoomNameHandler(method1, handler);
    ms.addRoomNameHandler(method2, 'by-key');
    ms.addRoomNameHandler(method3, ['array-key', 'key-by']);

    expect(ms.getRoomNameHandlers()).to.deep.equal({
      'test.method.1': handler,
      'test.method.2': 'by-key',
      'test.method.3': ['array-key', 'key-by'],
    });
  });

  it('should correctly remove room name handlers', () => {
    expect(ms.getRoomNameHandlers()).to.not.empty;

    ms.removeRoomNameHandler(method1);
    ms.removeRoomNameHandler(method2);
    ms.removeRoomNameHandler(method3);

    expect(ms.getRoomNameHandlers()).to.deep.equal({});
  });

  it('should correctly set microservice params', () => {
    ms.setParams({ ioServerOptions: { path: '/test' } });

    expect(ms)
      .to.have.property('params')
      .to.have.property('ioServerOptions')
      .to.deep.equal({ path: '/test' });

    // restore
    ms.setParams({ ioServerOptions });
  });

  it('should correctly set room channel params', () => {
    const room = 'test-room';
    const params = {
      channel1: { test: 'param' },
      channel2: { test: 'param' },
    };

    ms.setRoomChannelParams(room, params);

    expect(ms.getRoomsInfo()).to.deep.equal({
      [room]: params,
    });
  });

  it('should skip emit entity event to room: empty clients', async () => {
    const ioToStub = sandbox.stub(ms.getIoServer(), 'to');

    ms.setRoomChannelParams(`${method1}::empty-room`, { default: {} });

    await ms.emit(method1, { roomKey: 'empty-room', data: entity });

    expect(ioToStub).to.not.called;
  });

  it('should correctly emit entity event to room', async () => {
    const emitSub = sandbox.stub();
    const emitVolatile = sandbox.stub();
    const roomName = `${method1}::${entity.id}`;
    const roomNameRole = `${roomName}::user`;

    ms.setParams({
      makeRoomName: () => roomNameRole,
    });
    ms.setRoomChannelParams(roomName, {
      user: { userId: 'user-id' },
    });

    sandbox
      .stub(ms.getIoServer(), 'to')
      .returns({ emit: emitSub, volatile: { emit: emitVolatile } } as unknown as BroadcastOperator<
        never,
        never
      >);
    sandbox
      .stub(ms.getIoServer().sockets.adapter, 'rooms')
      .value(new Map().set(roomNameRole, new Set().add('socket-id')));

    // check apply middleware on response
    ms.addMiddleware(middlewareHandlerAfter, MiddlewareType.response);

    let isVolatile = false;

    for (const stub of [emitSub, emitVolatile]) {
      await ms.emit(method1, { roomKey: entity.id, data: entity, isVolatile });

      isVolatile = true;

      expect(stub).to.calledOnceWith(method1, { ...entity, middleware2: 'after' });
    }

    // restore
    ms.setParams({ makeRoomName: undefined });
  });

  let connectionMiddleware: Socket['useConnectionMiddlewares'];
  let signedRoomsMiddleware: Socket['useSignedRooms'];
  let ioConnectionHandler: (socket: any) => void;

  it('should correctly start microservice', async () => {
    const listenStub = sandbox.stub(ms.getIoServer(), 'listen');
    const httpCloseStub = sandbox.stub();
    const httpListenStub = sandbox
      .stub(ms.getHttpServer(), 'listen')
      .returns({ close: httpCloseStub } as never);

    // Configure io server stubs
    const ioServerUseStub = sandbox.stub(ms.getIoServer(), 'use');
    const ioServerOnStub = sandbox.stub(ms.getIoServer(), 'on');

    // Skip startWorkers
    sandbox.stub(axios, 'request').rejects(new Error('ECONNREFUSED'));

    await ms.start();

    // start http server logger
    httpListenStub.firstCall.lastArg();

    // save io functions for further testing
    [[connectionMiddleware], [signedRoomsMiddleware]] = ioServerUseStub.args as unknown as [
      [Socket['useConnectionMiddlewares']],
      [Socket['useSignedRooms']],
    ];
    [[, ioConnectionHandler]] = ioServerOnStub.args as unknown as [[string, (socket: any) => void]];

    expect(listenStub).to.calledOnceWith(ms.getHttpServer(), ioServerOptions);
    expect(httpListenStub).to.calledOnceWith(3005, '0.0.0.0');
    expect(httpCloseStub).to.calledOnce;
    expect(ioServerOnStub).to.calledOnce;
    expect(ioServerUseStub).to.calledTwice;
  });

  it('should correctly apply connection middlewares', async () => {
    const socket = { handshake: { headers: {} }, data: {} } as IoSocket;
    const nextStub = sandbox.stub();

    ms.addMiddleware(middlewareHandlerBefore);

    await connectionMiddleware(socket, nextStub);

    expect(socket.data).to.deep.equal({
      connMiddlewaresPayload: {
        hello: 'world',
      },
    });
    expect(nextStub).to.calledOnceWith();
  });

  it('should return error when apply failed connection middleware', async () => {
    const socket = { handshake: { headers: { authorization: 'token' } }, data: {} } as IoSocket;
    const nextStub = sandbox.stub();
    let task: Record<string, any> = {};
    const error = new BaseException({ message: 'Middleware failed.' });
    const middleware = (params: Record<string, any>) => {
      ({ task } = params);

      throw error;
    };

    ms.addMiddleware(middleware);

    await connectionMiddleware(socket, nextStub);

    ms.removeMiddleware(middleware);

    expect(socket.data).to.deep.equal({});
    expect(nextStub).to.calledOnceWith(error);
    expect(task.method).to.equal('client.connect');
    expect(task.params).to.deep.equal({
      payload: {
        headers: {
          authorization: 'token',
        },
        isInternal: false,
        sender: 'client',
      },
    });
  });

  it('should correctly apply signed rooms middlewares: empty rooms', () => {
    const socket = { handshake: { headers: {} }, data: {} } as IoSocket;
    const nextStub = sandbox.stub();

    signedRoomsMiddleware(socket, nextStub);

    expect(socket.data).to.deep.equal({ signedRooms: [] });
    expect(nextStub).to.calledOnceWith();
  });

  it('should return error signed rooms middlewares: invalid rooms', () => {
    const socket = { handshake: { headers: {} }, data: {} } as IoSocket;
    const nextStub = sandbox.stub();

    const cases = [
      {
        rooms: 'invalid-json-string',
        error: 'Invalid signed rooms. The rooms must be a JSON string.',
      },
      {
        rooms: '{"not-a":"array"}',
        error: 'Invalid signed rooms. The rooms must be a array.',
      },
      {
        rooms: '["invalid-token"]',
        error: 'Failed decode rooms: jwt malformed',
      },
    ];

    for (const { rooms, error } of cases) {
      socket.handshake.headers = { rooms };

      nextStub.resetHistory();

      signedRoomsMiddleware(socket, nextStub);

      const err = nextStub.firstCall.firstArg;

      expect(socket.data).to.deep.equal({});
      expect(err.message).to.equal(error);
    }
  });

  it('should correctly apply signed rooms middlewares: decoded from jwt', () => {
    const socket = { handshake: { headers: {} }, data: {} } as IoSocket;
    const nextStub = sandbox.stub();

    ms.setParams({
      makeRoomChannelInfo: () => ({ default: {} }),
    });

    socket.handshake.headers.rooms =
      '["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb29tcyI6WyJjaGF0Lmdyb3VwLmxpc3Q6OmFiMTQ5YmNiLThhZmItNDM0My05NWMyLTlmNzQ0YWFmMmFlMjo6dXNlciJdLCJpYXQiOjE2Nzc1MTU1NzYsImV4cCI6MTk4NzUxNzM3Nn0.eOHrwOyr5Nu9QQWjEeors9hZh88I_xsuyDEAPgkrmsE"]';

    signedRoomsMiddleware(socket, nextStub);

    expect(socket.data).to.deep.equal({
      signedRooms: ['chat.group.list::ab149bcb-8afb-4343-95c2-9f744aaf2ae2::user'],
    });
    expect(nextStub).to.calledOnceWith();
  });

  let handleSubscribe: IClientToServerEvents['subscribe'];
  const socket = {
    data: { signedRooms: [], connMiddlewaresPayload: {} },
    disconnect: sandbox.stub(),
    join: sandbox.stub(),
  };

  it('should correctly add socket listeners and join user to signed rooms', () => {
    const onSubscribeStub = sandbox.stub();

    const room = 'method::room-key';
    const roomUser = `${room}::user`;
    const userId = 'user-id';
    const stubMethods = {
      on: onSubscribeStub,
    };

    sandbox.stub(socket.data, 'signedRooms').value([roomUser]);
    sandbox.stub(socket.data, 'connMiddlewaresPayload').value({ authentication: { userId } });

    ioConnectionHandler({ ...socket, ...stubMethods });
    ioConnectionHandler({ ...socket, ...stubMethods, data: { signedRooms: [] } }); // empty rooms

    // save io functions for further testing
    [[, handleSubscribe]] = onSubscribeStub.args as unknown as [
      [string, IClientToServerEvents['subscribe']],
    ];

    expect(onSubscribeStub).to.calledTwice;
    expect(socket.join).to.calledOnceWith(roomUser);
    expect(ms).to.have.property('roomsInfo').to.have.property(room).to.deep.equal({
      default: {},
    });
  });

  it("shouldn't subscribe user to room: invalid request", async () => {
    const onConfirm = sandbox.stub();

    await handleSubscribe('invalid-request' as never, onConfirm);

    const { error } = onConfirm.firstCall.firstArg;

    expect(error.message).to.equal('Request parse error');
  });

  it("shouldn't subscribe user to room: invalid middleware", async () => {
    const onConfirm = sandbox.stub();
    const method = 'invalid-middleware';

    ms.addMiddleware(
      () => {
        throw new Error('Default error');
      },
      MiddlewareType.request,
      { match: method },
    );
    ms.addRoomNameHandler(method, 'id');

    await handleSubscribe({ id: 'id', method: 'invalid-middleware' }, onConfirm);

    const { error } = onConfirm.firstCall.firstArg;

    expect(error.message).to.equal('Default error');
    expect(error.code).to.equal(EXCEPTION_CODE.SOCKET_HANDLER_EXCEPTION);
  });

  it("shouldn't subscribe user to room: room handler doesn't exist", async () => {
    const onConfirm = sandbox.stub();

    await handleSubscribe({ id: 'id', method: 'unknown' }, onConfirm);

    const { error } = onConfirm.firstCall.firstArg;

    expect(error.message).to.equal('Failed subscribe, room not exist.');
  });

  it('should correctly subscribe user to room', async () => {
    socket.join.resetHistory();

    const sendRequestStub = sandbox.stub(ms, 'sendRequest');
    const onConfirm = sandbox.stub();
    const userId = 'current-user-id';
    const method = 'ms.method.action';

    ms.addMiddleware(middlewareHandlerBefore);
    ms.addMiddleware(middlewareHandlerAfter, MiddlewareType.response);

    ms.setParams({
      makeRoomName: (roomName, params) =>
        [roomName, params.request?.getParams()?.payload?.authorization?.roles[0]].join('::'),
      makeRoomChannelInfo: () => ({ default: {} }),
    });

    const cases = [
      { roomHandler: 'id', msResult: entity },
      { roomHandler: ['list', 'id'], msResult: { list: [entity] } },
      { roomHandler: (response: Record<string, any>) => [response.result.id], msResult: entity },
      { roomHandler: 'empty', msResult: undefined },
    ];

    for (const { roomHandler, msResult } of cases) {
      onConfirm.resetHistory();
      socket.join.resetHistory();

      ms.addRoomNameHandler(method, roomHandler);

      sendRequestStub.callsFake((_, reqParams) =>
        Promise.resolve(new MicroserviceResponse({ result: { ...msResult, ...reqParams } })),
      );

      await handleSubscribe(
        {
          id: 'id',
          method,
          params: {
            payload: { authentication: { userId }, authorization: { roles: ['user', 'guest'] } },
          },
        },
        onConfirm,
      );

      const { result } = onConfirm.firstCall.firstArg;

      if (msResult) {
        expect(socket.join).to.calledWith([`${method}::${entity.id}::user`]);
        expect(result?.list?.[0].id ?? result.id).to.equal(entity.id);
        expect(result.middleware1).to.equal('before');
        expect(result.middleware2).to.equal('after');
        expect(result.payload.roomsToken).to.not.empty;
      } else {
        // rooms empty
        expect(socket.join).to.not.called;
      }
    }
  });
});
