import type { AxiosResponse } from 'axios';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import type { IMicroserviceResponseResult } from '@interfaces/core/i-microservice-response';
import type { LogDriverType } from '@interfaces/drivers/log-driver';
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
  req: ITask['req'];
}

type EndpointHandler = (
  params: IMicroserviceRequest['params'],
  options: IEndpointOptions,
) => IMicroserviceResponseResult;

interface ITask {
  task: MicroserviceRequest | MicroserviceResponse;
  req: AxiosResponse<IMicroserviceRequest>;
  time: number;
}

export { IMicroserviceParams, IMicroserviceOptions, ITask, EndpointHandler };
