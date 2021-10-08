import BaseException from '@core/base-exception';

/**
 * Microservices data
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IMicroserviceResponsePayload {}

interface IMicroserviceResponse {
  id?: string | number;
  result?: Record<string, any> & { payload?: IMicroserviceResponsePayload };
  error?: BaseException;
}

type IMicroserviceResponseJson = (IMicroserviceResponse & { jsonrpc: string }) | undefined;

type IMicroserviceResponseResult =
  | IMicroserviceResponse['result']
  | Promise<IMicroserviceResponse['result']>
  | undefined;

export { IMicroserviceResponse, IMicroserviceResponseJson, IMicroserviceResponseResult };
