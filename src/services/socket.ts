import * as crypto from 'crypto';
import * as http from 'http';
import type { JwtPayload } from 'jsonwebtoken';
import jsonwebtoken from 'jsonwebtoken';
import _ from 'lodash';
import type { Socket as IoSocket } from 'socket.io';
import { Server } from 'socket.io';
import { EXCEPTION_CODE } from '@constants/index';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import { LogType } from '@interfaces/drivers/console-log';
import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import type { TJsonRPC } from '@interfaces/services/i-gateway';
import type {
  IClientToServerEvents,
  IServerToClientEvents,
  IServerToSeverEvents,
  ISocketData,
  ISocketOptions,
  ISocketParams,
  ISocketRoomsInfo,
  TIoSocketNext,
  TSocketRoomHandler,
  ISocketRoomsHandlers,
  TSocketEmitParams,
} from '@interfaces/services/i-socket';
import AbstractMicroservice from '@services/abstract-microservice';

/**
 * Base class for create socket
 */
class Socket extends AbstractMicroservice {
  /**
   * Socket options
   * @protected
   */
  protected options: ISocketOptions = {
    name: 'socket',
    version: '1.0.0',
    listener: '0.0.0.0:3005',
    connection: 'http://127.0.0.1:8001', // ijson connection
    isSRV: false,
    reqTimeout: 1000 * 15, // 15 seconds
    eventWorkers: 5,
    eventWorkerTimeout: 1800, // 30 min
    roomExpiration: 1800, // 30 min
  };

  /**
   * Socket params
   * @protected
   */
  protected params: Partial<ISocketParams> = {};

  /**
   * Registered room name generators
   * @private
   */
  protected readonly rooms: ISocketRoomsHandlers = {};

  /**
   * List rooms with info about user count by roles
   * @protected
   */
  protected roomsInfo: ISocketRoomsInfo = {};

  /**
   * Http server
   * @private
   */
  protected readonly httpServer: http.Server = http.createServer();

  /**
   * Socket app
   * @private
   */
  protected readonly ioServer: Server<
    IClientToServerEvents,
    IServerToClientEvents,
    IServerToSeverEvents,
    ISocketData
  > = new Server();

  /**
   * @constructor
   * @protected
   */
  protected constructor(
    options: Partial<ISocketOptions> = {},
    params: Partial<ISocketParams> = {},
  ) {
    super();

    if (Socket.instance) {
      throw new Error("Don't use the constructor to create this object. Use create instead.");
    }

    this.init(options, params);
  }

  /**
   * Create socket instance
   */
  public static create(options?: Partial<ISocketOptions>, params?: Partial<ISocketParams>): Socket {
    if (!Socket.instance) {
      Socket.instance = new this(options, params);
    }

    return Socket.instance as Socket;
  }

  /**
   * Get microservice instance
   */
  public static getInstance(): Socket {
    return Socket.instance as Socket;
  }

  /**
   * Get io server instance
   */
  public getIoServer(): Server {
    return this.ioServer;
  }

  /**
   * Get http server instance
   */
  public getHttpServer(): http.Server {
    return this.httpServer;
  }

  /**
   * Add room name handler
   */
  public addRoomNameHandler(method: string, handler: TSocketRoomHandler): Socket {
    this.rooms[method] = handler;

    return this;
  }

  /**
   * Return room name handlers
   */
  public getRoomNameHandlers(): ISocketRoomsHandlers {
    return this.rooms;
  }

  /**
   * Remove room name handler
   */
  public removeRoomNameHandler(method: string): Socket {
    _.unset(this.rooms, method);

    return this;
  }

  /**
   * Set microservice params
   */
  public setParams(params: Partial<ISocketParams>): void {
    this.params = { ...this.params, ...params };
  }

  /**
   * Get rooms info
   */
  public getRoomsInfo(): ISocketRoomsInfo {
    return this.roomsInfo;
  }

  /**
   * Set rooms info channel params
   */
  public setRoomChannelParams(
    room: string,
    channelsParams: Record<string, Record<string, any>>,
  ): void {
    if (!this.roomsInfo[room]) {
      this.roomsInfo[room] = {};
    }

    Object.entries(channelsParams).forEach(([channel, params]) => {
      this.roomsInfo[room][channel] = { ...(this.roomsInfo[room]?.[channel] ?? {}), ...params };
    });
  }

  /**
   * Emit entity event to room
   */
  public async emit(
    method: string,
    { roomKey, data, isVolatile = false }: TSocketEmitParams,
  ): Promise<void> {
    const { makeRoomName } = this.params;
    const roomName = [method, roomKey].filter(Boolean).join('::');
    const subscribeInfoRoute = this.roomsInfo[roomName] ?? {};

    for (const channel of Object.entries(subscribeInfoRoute)) {
      const room = makeRoomName?.(roomName, { channel }) ?? roomName;
      const roomClients = this.ioServer.sockets.adapter.rooms.get(room)?.size ?? 0;

      if (!roomClients) {
        continue;
      }

      const result = await this.applyMiddlewares(
        {
          task: new MicroserviceRequest({
            id: crypto.randomUUID(),
            method: 'client.emit',
            params: {
              method,
              channel,
              isInternal: true,
            },
          }),
          result: data,
        },
        {} as never,
        MiddlewareType.response,
      );

      _.set(result ?? {}, 'payload', {
        ...(result?.payload ?? {}),
        ...(data?.payload ?? {}),
      });

      const ioRoom = this.ioServer.to(room);

      if (isVolatile) {
        ioRoom.volatile.emit(method, result);
      } else {
        ioRoom.emit(method, result);
      }
    }
  }

  /**
   * Use socket connection middlewares
   * @protected
   */
  protected async useConnectionMiddlewares(socket: IoSocket, next: TIoSocketNext): Promise<void> {
    const connectionRequest = new MicroserviceRequest({
      id: crypto.randomUUID(),
      method: 'client.connect',
      params: {
        payload: {
          sender: 'client',
          isInternal: false,
          headers: socket.handshake.headers,
        },
      },
    });

    try {
      const data = await this.applyMiddlewares({ task: connectionRequest }, socket);

      socket.data.connMiddlewaresPayload = data?.payload ?? {};

      next();
    } catch (e) {
      next(e as BaseException);
    }
  }

  /**
   * Validate user signed rooms
   * @protected
   */
  protected useSignedRooms(socket: IoSocket, next: TIoSocketNext): void {
    try {
      socket.data.signedRooms = this.decryptRooms(socket.handshake.headers?.rooms as string);

      next();
    } catch (e) {
      next(e as BaseException);
    }
  }

  /**
   * Subscribe request handler
   * @protected
   */
  protected async handleSubscribeRequest(
    socket: IoSocket,
    req: TJsonRPC,
    onConfirm?: (response: MicroserviceResponse) => void,
  ): Promise<void> {
    const invalidRequest = this.validateRequest(req);

    if (invalidRequest) {
      return onConfirm?.(invalidRequest);
    }

    const { makeRoomName, makeRoomChannelInfo } = this.params;
    const request = new MicroserviceRequest(req);

    this.logDriver(
      () => `--> from client: ${request.toString()}`,
      LogType.REQ_EXTERNAL,
      `${request.getId()!}-socket`,
    );

    const response = new MicroserviceResponse({ id: request.getId() });
    const roomHandler = this.rooms[request.getMethod()];
    const method = request.getMethod();

    try {
      if (!roomHandler) {
        throw new BaseException({
          code: EXCEPTION_CODE.SOCKET_HANDLER_EXCEPTION,
          message: 'Failed subscribe, room not exist.',
          status: 500,
        });
      }

      // apply connection middleware
      _.set(request, 'params.payload', {
        ...(request.getParams()?.payload ?? {}),
        ...socket.data.connMiddlewaresPayload,
      });

      const reqParams = await this.applyMiddlewares({ task: request }, socket);
      const reqArgs = [
        method,
        reqParams,
        {
          isInternal: false,
          reqId: request.getId(),
          logPadding: '',
          reqParams: {
            headers: {
              Option: 'if present',
            },
            timeout: this.options.reqTimeout,
          },
        },
      ] as Required<Parameters<typeof Socket.prototype.sendRequest>>;
      const resResult = await this.sendRequest(...reqArgs);
      const result = await this.applyMiddlewares(
        { task: request, result: resResult.getResult() },
        socket,
        MiddlewareType.response,
      );

      response.setResult(result);
    } catch (e) {
      if (e instanceof BaseException) {
        response.setError(e);
      } else {
        response.setError(
          this.getException({
            code: EXCEPTION_CODE.SOCKET_HANDLER_EXCEPTION,
            message: e.message,
            status: 500,
          }),
        );
      }
    } finally {
      this.logDriver(
        () => `<-- to client: ${response.toStackString()}`,
        LogType.RES_EXTERNAL,
        `${response.getId()!}-socket`,
      );
    }

    if (response.getError()) {
      return onConfirm?.(response);
    }

    // keys for rooms
    let roomKeys = [];

    switch (typeof roomHandler) {
      case 'function':
        roomKeys.push(...roomHandler(response));
        break;

      case 'object':
        const [arrPath, roomKey] = roomHandler as [string, string];

        roomKeys.push(
          ...(_.map(_.get(response.getResult(), arrPath) as any[], roomKey) as string[]),
        );
        break;

      case 'string':
        roomKeys.push(_.get(response.getResult(), roomHandler));
        break;
    }

    roomKeys = roomKeys.filter(Boolean);

    if (roomKeys.length) {
      roomKeys = roomKeys.map((roomKey) => {
        const roomName = [method, roomKey].join('::');
        const room = makeRoomName?.(roomName, { request }) ?? roomName;
        const channelsInfo = makeRoomChannelInfo?.({ room, request, socket }) ?? { default: {} };

        this.setRoomChannelParams(roomName, channelsInfo);

        return room;
      });

      await socket.join(roomKeys);

      // add signed rooms to response
      _.set(response.getResult() ?? {}, 'payload.roomsToken', this.encryptRooms(roomKeys));
    }

    onConfirm?.(response);
  }

  /**
   * Configure io server
   * @private
   */
  protected configureIoServer(): void {
    /**
     * Apply connection middlewares
     */
    this.ioServer.use((socket, next) => this.useConnectionMiddlewares(socket, next) as never);
    this.ioServer.use((socket, next) => this.useSignedRooms(socket, next));

    /**
     * Implement default listeners
     */
    this.ioServer.on('connection', (socket) => {
      // restore signed rooms
      this.joinToSignedRooms(socket, socket.data.signedRooms);

      socket.on('subscribe', async (req, onConfirm) => {
        await this.handleSubscribeRequest(socket, req, onConfirm);
      });
    });
  }

  /**
   * Auto join user to signed rooms
   * @protected
   */
  protected joinToSignedRooms(socket: IoSocket, rooms?: string[]): void {
    if (!rooms?.length) {
      return;
    }

    const { makeRoomChannelInfo } = this.params;

    rooms.forEach((room) => {
      const [method, roomKey] = room.split('::');
      const roomName = [method, roomKey].join('::');
      const channelsInfo = makeRoomChannelInfo?.({ room, socket }) ?? { default: {} };

      void socket.join(room);
      this.setRoomChannelParams(roomName, channelsInfo);
    });
  }

  /**
   * Decrypt rooms
   * @protected
   */
  public decryptRooms(rooms?: string): string[] {
    const { signRoomOptions: { secretKey } = {} } = this.params;

    if (!rooms || !rooms.length) {
      return [];
    }

    let decodedRooms = [];

    try {
      decodedRooms = JSON.parse(rooms) as string[];
    } catch (e) {
      throw new BaseException({
        status: 422,
        message: 'Invalid signed rooms. The rooms must be a JSON string.',
      });
    }

    if (!Array.isArray(decodedRooms)) {
      throw new BaseException({
        status: 422,
        message: 'Invalid signed rooms. The rooms must be a array.',
      });
    }

    const result: string[] = [];

    decodedRooms.forEach((roomToken) => {
      try {
        const jwt = jsonwebtoken.verify(roomToken, secretKey!) as JwtPayload;

        result.push(...((jwt?.rooms ?? []) as string[]));
      } catch (e) {
        const jwt = jsonwebtoken.decode(roomToken) as JwtPayload;

        throw new BaseException({
          message: `Failed decode rooms: ${e.message as string}`,
          payload: { rooms: jwt?.rooms },
        });
      }
    });

    return result;
  }

  /**
   * Encrypt rooms
   * @protected
   */
  public encryptRooms(rooms: string[]): string {
    const { signRoomOptions: { secretKey } = {} } = this.params;
    const { roomExpiration } = this.options;

    return jsonwebtoken.sign({ rooms }, secretKey!, {
      expiresIn: roomExpiration,
    });
  }

  /**
   * Run microservice
   */
  public start(): Promise<void | void[]> {
    const { name, version, listener, eventWorkers } = this.options;
    const { ioServerOptions } = this.params;
    const [host, port] = listener.split(':');

    this.logDriver(() => `${name} start. Version: ${version}`, LogType.INFO);

    this.configureIoServer();
    this.ioServer.listen(this.httpServer, ioServerOptions);

    const server = this.httpServer.listen(Number(port), host, () => {
      this.logDriver(
        () => `Client listener "${name}" started on: ${listener}. Version: ${version}`,
        LogType.INFO,
      );
    });

    return this.startWorkers(1, eventWorkers).then(() => {
      server.close();
    });
  }
}

export default Socket;
