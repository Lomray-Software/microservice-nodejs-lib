import type { Request } from 'express';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import type { LogDriverType } from '@interfaces/drivers/log-driver';
import AbstractMicroservice from '@services/abstract-microservice';

interface IGatewayOptions {
  name: string;
  version: string;
  listener: string;
  connection: string;
  isSRV: boolean;
  infoRoute: string | null; // health checks, etc.
  reqTimeout: number;
}

interface IGatewayParams {
  logDriver: boolean | LogDriverType;
}

interface IExpressRequest extends Request {
  body: {
    id: number | string;
    method: string;
    params?: IMicroserviceRequest['params'];
  };
}

type GatewayEndpointHandler = AbstractMicroservice['sendRequest'] | null;

interface IHttpException extends Error {
  status?: number;
  statusCode?: number;
  code?: number;
  message: string;
  service?: string;
}

export { IGatewayOptions, IGatewayParams, IExpressRequest, GatewayEndpointHandler, IHttpException };
