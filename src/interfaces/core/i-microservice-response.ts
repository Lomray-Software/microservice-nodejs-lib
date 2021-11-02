import BaseException from '@core/base-exception';

/**
 * Microservices data
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IMicroserviceResponsePayload {}

type PayloadExtends<TParams> = TParams & IMicroserviceResponsePayload;

interface IMicroserviceResponse<TParams = Record<string, any>, TPayload = Record<string, any>> {
  id?: string | number;
  result?: TParams & { payload?: PayloadExtends<TPayload> };
  error?: BaseException;
}

type IMicroserviceResponseJson<TParams = Record<string, any>> =
  | (IMicroserviceResponse<TParams> & { jsonrpc: string })
  | undefined;

type IMicroserviceResponseResult<TParams = Record<string, any>> =
  | IMicroserviceResponse<TParams>['result']
  | Promise<IMicroserviceResponse<TParams>['result']>
  | undefined;

export { IMicroserviceResponse, IMicroserviceResponseJson, IMicroserviceResponseResult };
