/**
 * Microservices data
 */
interface IMicroserviceRequestPayload {
  sender?: string;
  isInternal?: boolean;
}

interface IMicroserviceRequest<
  TParams = Record<string, any>,
  TPayload = Record<string, any> & IMicroserviceRequestPayload,
> {
  id?: string | number;
  method: string;
  params?: TParams & { payload?: TPayload };
}

type IMicroserviceRequestJson<
  TParams = Record<string, any>,
  TPayload = Record<string, any> & IMicroserviceRequestPayload,
> = IMicroserviceRequest<TParams, TPayload> & {
  jsonrpc: string;
};

export { IMicroserviceRequest, IMicroserviceRequestJson };
