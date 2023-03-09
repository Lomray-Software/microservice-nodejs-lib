import type { ServerOptions, Socket as IoSocket } from 'socket.io';
import type { ExtendedError } from 'socket.io/dist/namespace';
import type MicroserviceRequest from '@core/microservice-request';
import type MicroserviceResponse from '@core/microservice-response';
import type {
  IAbstractMicroserviceOptions,
  IAbstractMicroserviceParams,
} from '@interfaces/services/i-abstract-microservice';
import type { TJsonRPC } from '@interfaces/services/i-gateway';

export interface ISocketOptions extends IAbstractMicroserviceOptions {
  listener: string;
  reqTimeout: number;
  roomExpiration?: number;
  infoRoute: string | null; // health checks, etc.
}

export interface ISocketParams extends IAbstractMicroserviceParams {
  ioServerOptions?: Partial<ServerOptions>;
  signRoomOptions: { secretKey: string };
  makeRoomName?: (
    roomName: string,
    params: {
      channel?: [channelName: string, params: Record<string, any>];
      request?: MicroserviceRequest;
    },
  ) => string;
  makeRoomChannelInfo?: (params: {
    room: string;
    socket: IoSocket;
    request?: MicroserviceRequest;
  }) => Record<string, Record<string, any>>;
}

export interface ISocketRoomsHandlers {
  [method: string]: TSocketRoomHandler;
}

export interface ISocketRoomsInfo {
  [room: string]: {
    [channel: string]: Record<string, any>; // channel params
  };
}

export type TSocketRoomHandler<TResponse = Record<string, any>> =
  | ((response: MicroserviceResponse<TResponse>) => string[])
  | ([string, string] | string[]) // keys from array
  | string; // key from object

export type TSocketEmitParams = {
  roomKey?: string;
  data?: Record<string, any>;
  isVolatile?: boolean;
};

export type TIoSocketNext = (err?: ExtendedError) => void;

export interface IServerToClientEvents extends Record<string, any> {}

export interface IClientToServerEvents extends Record<string, any> {
  subscribe: (
    request: TJsonRPC,
    onConfirm?: (response: MicroserviceResponse) => void,
  ) => Promise<void>;
}

export interface IServerToSeverEvents extends Record<string, any> {}

export interface ISocketData {
  /**
   * Connection middlewares payload
   */
  connMiddlewaresPayload: Record<string, any>;
  signedRooms: string[];
}
