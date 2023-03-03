import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { Request } from 'express';
import type { Socket } from 'socket.io';
import type MicroserviceRequest from '@core/microservice-request';
import type MicroserviceResponse from '@core/microservice-response';
import type { IEventRequest } from '@interfaces/core/i-event-request';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import type {
  IMicroserviceResponseResult,
  IMicroserviceResponse,
} from '@interfaces/core/i-microservice-response';
import type { LogDriverType } from '@interfaces/drivers/console-log';
import type AbstractMicroservice from '@services/abstract-microservice';

interface IAbstractMicroserviceOptions {
  name: string;
  version: string;
  connection: string;
  isSRV: boolean;
  eventWorkers: number;
  eventWorkerTimeout: number;
}

interface IAbstractMicroserviceParams {
  logDriver: boolean | LogDriverType;
}

interface IInnerRequestParams {
  shouldGenerateId?: boolean;
  reqId?: string | number;
  logPadding?: string;
  reqParams?: AxiosRequestConfig;
  isInternal?: boolean;
  isThrowError?: boolean;
}

type ProcessExitHandler = (eventOrExitCodeOrError: Error | number) => void | Promise<void>;

type MiddlewareData<TParams = Record<string, any>, TPayload = Record<string, any>> = {
  task: MicroserviceRequest<TParams, TPayload>;
  result?: IMicroserviceResponse<TParams>['result'];
};

type MiddlewareClientRequest = ITask['req'] | Request | Socket;

type MiddlewareHandler = (
  data: MiddlewareData,
  req: MiddlewareClientRequest,
) =>
  | IMicroserviceRequest['params']
  | Promise<IMicroserviceRequest['params']>
  | IMicroserviceResponseResult;

enum MiddlewareType {
  request = 'request',
  response = 'response',
}

type StoredMiddleware = { handler: MiddlewareHandler; params: IMiddlewareParams };

interface IMiddlewares {
  [MiddlewareType.request]: StoredMiddleware[];
  [MiddlewareType.response]: StoredMiddleware[];
}

interface IMiddlewareParams {
  match: string;
  exclude: string[];
}

interface IEndpointOptions {
  app: AbstractMicroservice;
  req: ITask['req'];
  sender?: string;
}

interface IEndpointHandler<
  TParams = Record<string, any>,
  TPayload = Record<string, any>,
  TResult = Record<string, any>,
> {
  (
    params: NonNullable<IMicroserviceRequest<TParams, TPayload>['params']>,
    options: IEndpointOptions,
  ): IMicroserviceResponseResult<TResult>;
}

interface IEndpointHandlerOptions {
  isDisableMiddlewares: boolean;
  isPrivate: boolean;
}

interface IEndpoints {
  [path: string]: {
    handler: IEndpointHandler;
    options: IEndpointHandlerOptions;
  };
}

interface IEventHandlerOptions {
  app: AbstractMicroservice;
  sender?: string;
}

interface IEventHandler<TParams = Record<string, any>> {
  (params: IEventRequest<TParams>, options: IEventHandlerOptions):
    | Promise<void | boolean>
    | void
    | boolean;
}

interface ITask {
  task: MicroserviceRequest | MicroserviceResponse;
  req: AxiosResponse<IMicroserviceRequest>;
}

type SendRequestMethod<
  TRequestParams = Record<string, any>,
  TResponseResult = Record<string, any>,
> = (
  method: string,
  data: MicroserviceRequest<TRequestParams | Record<string, any>>['params'],
  params: IInnerRequestParams,
) => Promise<MicroserviceResponse<TResponseResult>>;

export {
  IAbstractMicroserviceOptions,
  IAbstractMicroserviceParams,
  IInnerRequestParams,
  ProcessExitHandler,
  IMiddlewares,
  MiddlewareData,
  MiddlewareType,
  MiddlewareHandler,
  MiddlewareClientRequest,
  IMiddlewareParams,
  IEndpoints,
  IEndpointOptions,
  IEventHandler,
  IEventHandlerOptions,
  IEndpointHandler,
  IEndpointHandlerOptions,
  ITask,
  SendRequestMethod,
};
