/* eslint-disable @typescript-eslint/naming-convention */
import type { NextFunction, ParamsDictionary, Request, Response } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

declare module 'express-serve-static-core' {
  export interface RequestHandler<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    Locals extends Record<string, any> = Record<string, any>,
  > {
    // tslint:disable-next-line callable-types (This is extended from and can't extend from a type alias in ts<2.2)
    (
      req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
      res: Response<ResBody, Locals>,
      next: NextFunction,
    ): void | Promise<void>;
  }
}
