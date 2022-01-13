import type { CookieOptions } from 'express-serve-static-core';
import BaseException from '@core/base-exception';

/**
 * Microservices data
 */
interface IMicroserviceResponsePayload {
  cookies?: {
    action: 'add' | 'remove';
    name: string;
    value?: string;
    options?: CookieOptions;
  }[];
}

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
