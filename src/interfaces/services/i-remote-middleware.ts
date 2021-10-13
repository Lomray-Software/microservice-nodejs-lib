import {
  IAbstractMicroserviceParams,
  IInnerRequestParams,
  MiddlewareType,
} from '@interfaces/services/i-abstract-microservice';

interface IRemoteMiddlewareParams {
  logDriver: IAbstractMicroserviceParams['logDriver'];
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

export {
  IRemoteMiddlewareParams,
  IRemoteMiddlewareReqParams,
  IRemoteMiddlewareEndpointParams,
  RemoteMiddlewareActionType,
};
