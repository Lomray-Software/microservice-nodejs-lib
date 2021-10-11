import { AxiosRequestConfig } from 'axios';
import { Request } from 'express';
import MicroserviceRequest from '@core/microservice-request';
import { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import { IMicroserviceResponseResult } from '@interfaces/core/i-microservice-response';
import { ITask } from '@interfaces/services/i-microservice';

interface IInnerRequestParams {
  shouldGenerateId?: boolean;
  reqId?: string | number;
  reqParams?: AxiosRequestConfig;
}

type ProcessExitHandler = (eventOrExitCodeOrError: Error | number) => void | Promise<void>;

type MiddlewareData = { task: MicroserviceRequest; result?: IMicroserviceResponseResult };

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

export {
  IInnerRequestParams,
  ProcessExitHandler,
  IMiddlewares,
  MiddlewareData,
  MiddlewareType,
  MiddlewareHandler,
  MiddlewareClientRequest,
};
