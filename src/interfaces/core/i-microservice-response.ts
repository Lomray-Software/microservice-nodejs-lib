import type { CookieOptions } from 'express-serve-static-core';
import type BaseException from '@core/base-exception';

enum CookiesAction {
  add = 'add',
  remove = 'remove',
}

interface IMicroserviceResponseCookie {
  action: keyof typeof CookiesAction;
  name: string;
  value?: string;
  options?: CookieOptions;
}

/**
 * Microservices data
 */
interface IMicroserviceResponsePayload {
  cookies?: IMicroserviceResponseCookie[];
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

export {
  IMicroserviceResponse,
  IMicroserviceResponseJson,
  IMicroserviceResponseResult,
  CookiesAction,
  IMicroserviceResponseCookie,
};
