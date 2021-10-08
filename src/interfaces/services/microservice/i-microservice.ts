import type { AxiosResponse, AxiosRequestConfig } from 'axios';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import type { IMicroserviceResponseResult } from '@interfaces/core/i-microservice-response';
import type { LogDriverType } from '@interfaces/services/microservice/log-driver';
import Microservice from '@services/microservice';

interface IMicroserviceOptions {
  name: string;
  version: string;
  connection: string;
  isSRV: boolean;
  workers: number;
}

interface IMicroserviceParams {
  logDriver: boolean | LogDriverType;
}

interface IEndpointOptions {
  app: Microservice;
  res: ITask['res'];
}

type EndpointHandler = (
  params: IMicroserviceRequest['params'],
  options: IEndpointOptions,
) => IMicroserviceResponseResult;

type MiddlewareData = { task: MicroserviceRequest; result?: IMicroserviceResponseResult };

type MiddlewareHandler = (
  data: MiddlewareData,
  req: ITask['res'],
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

type ProcessExitHandler = (eventOrExitCodeOrError: Error | number) => void | Promise<void>;

interface ITask {
  task: MicroserviceRequest | MicroserviceResponse;
  res: AxiosResponse<IMicroserviceRequest>;
  time: number;
}

interface IInnerRequestParams {
  shouldGenerateId?: boolean;
  reqParams?: AxiosRequestConfig;
}

export {
  IMicroserviceParams,
  IMicroserviceOptions,
  IMiddlewares,
  MiddlewareData,
  MiddlewareType,
  EndpointHandler,
  MiddlewareHandler,
  ProcessExitHandler,
  ITask,
  IInnerRequestParams,
};
