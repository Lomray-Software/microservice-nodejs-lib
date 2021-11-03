import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { Request } from 'express';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import type { IMicroserviceResponseResult } from '@interfaces/core/i-microservice-response';
import type { LogDriverType } from '@interfaces/drivers/log-driver';
import AbstractMicroservice from '@services/abstract-microservice';

interface IAbstractMicroserviceOptions {
  name: string;
  version: string;
  connection: string;
  isSRV: boolean;
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
}

type ProcessExitHandler = (eventOrExitCodeOrError: Error | number) => void | Promise<void>;

type MiddlewareData<TParams = Record<string, any>, TPayload = Record<string, any>> = {
  task: MicroserviceRequest<TParams, TPayload>;
  result?: IMicroserviceResponseResult;
};

type MiddlewareClientRequest = ITask['req'] | Request;

type MiddlewareHandler = (
  data: MiddlewareData,
  req: MiddlewareClientRequest,
) =>
  | IMicroserviceRequest['params']
  | Promise<IMicroserviceRequest['params']>
  | IMicroserviceResponseResult
  | Promise<IMicroserviceResponseResult>;

enum MiddlewareType {
  request = 'request',
  response = 'response',
}

interface IMiddlewares {
  [MiddlewareType.request]: MiddlewareHandler[];
  [MiddlewareType.response]: MiddlewareHandler[];
}

interface IEndpointOptions {
  app: AbstractMicroservice;
  req: ITask['req'];
  sender?: string;
}

interface IEndpointHandler<TParams = Record<string, any>, TPayload = Record<string, any>> {
  (
    params: NonNullable<IMicroserviceRequest<TParams, TPayload>['params']>,
    options: IEndpointOptions,
  ): IMicroserviceResponseResult;
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
  IEndpoints,
  IEndpointOptions,
  IEndpointHandler,
  IEndpointHandlerOptions,
  ITask,
  SendRequestMethod,
};
