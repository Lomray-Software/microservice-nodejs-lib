import {
  IAbstractMicroserviceParams,
  IInnerRequestParams,
  MiddlewareType,
} from '@interfaces/services/i-abstract-microservice';

interface IRemoteMiddlewareParams {
  logDriver: IAbstractMicroserviceParams['logDriver'];
  endpoint: string;
}

interface IRemoteMiddlewareReqParams {
  type?: MiddlewareType;
  isRequired?: boolean;
  reqParams?: IInnerRequestParams;
}

enum RemoteMiddlewareActionType {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
}

interface IRemoteMiddlewareEndpointParams {
  action: RemoteMiddlewareActionType;
  method: string;
  options?: IRemoteMiddlewareReqParams;
}

interface IRegisterRemoteParams {
  timeout: number;
  shouldCancelRegister: boolean;
}

interface IRemoteMiddlewareRequest {
  status: string;
  headers: string;
  query: string;
  params: string;
  statusCode: string;
  statusText: string;
  httpVersion: string;
}

export {
  IRemoteMiddlewareParams,
  IRemoteMiddlewareReqParams,
  IRemoteMiddlewareEndpointParams,
  RemoteMiddlewareActionType,
  IRegisterRemoteParams,
  IRemoteMiddlewareRequest,
};
