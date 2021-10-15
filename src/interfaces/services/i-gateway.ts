import type { Request } from 'express';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import type {
  IAbstractMicroserviceOptions,
  IAbstractMicroserviceParams,
} from '@interfaces/services/i-abstract-microservice';
import AbstractMicroservice from '@services/abstract-microservice';

interface IGatewayOptions extends IAbstractMicroserviceOptions {
  listener: string;
  infoRoute: string | null; // health checks, etc.
  reqTimeout: number;
  hasAutoRegistrationEndpoint: boolean;
}

interface IGatewayParams extends IAbstractMicroserviceParams {}

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

enum AutoRegistrationAction {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
}

export {
  IGatewayOptions,
  IGatewayParams,
  IExpressRequest,
  GatewayEndpointHandler,
  IHttpException,
  AutoRegistrationAction,
};
