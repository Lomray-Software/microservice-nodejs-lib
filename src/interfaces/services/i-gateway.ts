import type { OptionsJson } from 'body-parser';
import type { Express, Request } from 'express';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import type {
  IAbstractMicroserviceOptions,
  IAbstractMicroserviceParams,
  SendRequestMethod,
} from '@interfaces/services/i-abstract-microservice';

interface IGatewayOptions extends IAbstractMicroserviceOptions {
  listener: string;
  infoRoute: string | null; // health checks, etc.
  reqTimeout: number;
  hasAutoRegistration: boolean;
  batchLimit: number;
  jsonParams: OptionsJson;
}

interface IGatewayParams extends IAbstractMicroserviceParams {
  beforeRoute: (express: Express) => void;
  afterRoute: (express: Express) => void;
}

interface IExpressRequest extends Request {
  body: {
    id: number | string;
    method: string;
    params?: IMicroserviceRequest['params'];
  };
}

type GatewayEndpointHandler = SendRequestMethod | null;

interface IHttpException extends Error {
  status?: number;
  statusCode?: number;
  code?: number;
  message: string;
  service?: string;
}

export { IGatewayOptions, IGatewayParams, IExpressRequest, GatewayEndpointHandler, IHttpException };
