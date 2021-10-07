/**
 * Microservices data
 */
interface IMicroserviceRequestPayload {
  sender?: string;
}

interface IMicroserviceRequest {
  id?: number;
  method: string;
  params?: Record<string, any> & { payload?: IMicroserviceRequestPayload };
}

type IMicroserviceRequestJson = IMicroserviceRequest & {
  jsonrpc: string;
};

export { IMicroserviceRequest, IMicroserviceRequestJson };
