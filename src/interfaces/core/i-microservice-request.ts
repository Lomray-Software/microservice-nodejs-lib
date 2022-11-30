/**
 * Microservices data
 */
interface IMicroserviceRequestPayload {
  sender?: string;
  isInternal?: boolean;
  headers?: Record<string, any>;
}

type PayloadExtends<TParams> = TParams & IMicroserviceRequestPayload;

interface IMicroserviceRequest<TParams = Record<string, any>, TPayload = Record<string, any>> {
  id?: string | number;
  method: string;
  params?: TParams & { payload?: PayloadExtends<TPayload> };
}

type IMicroserviceRequestJson<
  TParams = Record<string, any>,
  TPayload = Record<string, any>,
> = IMicroserviceRequest<TParams, PayloadExtends<TPayload>> & {
  jsonrpc: string;
};

export { IMicroserviceRequest, IMicroserviceRequestJson };
