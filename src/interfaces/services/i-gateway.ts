import type { OptionsJson } from 'body-parser';
import type { CompressionOptions } from 'compression';
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
  compressionOptions?: CompressionOptions | false;
}

interface IGatewayParams extends IAbstractMicroserviceParams {
  beforeRoute: (express: Express) => void | Promise<void>;
  afterRoute: (express: Express) => void | Promise<void>;
}

type TJsonRPC = {
  id: number | string;
  method: string;
  params?: IMicroserviceRequest['params'];
};

interface IExpressRequest extends Request {
  body: TJsonRPC | TJsonRPC[];
}

type GatewayEndpointHandler = SendRequestMethod | null;

interface IHttpException extends Error {
  status?: number;
  statusCode?: number;
  code?: number;
  message: string;
  service?: string;
}

export {
  IGatewayOptions,
  IGatewayParams,
  IExpressRequest,
  GatewayEndpointHandler,
  IHttpException,
  TJsonRPC,
};
