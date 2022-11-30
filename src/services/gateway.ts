import compression from 'compression';
import type { Express, Request, Response } from 'express';
import express from 'express';
import type { NextFunction } from 'express-serve-static-core';
import _ from 'lodash';
import { EXCEPTION_CODE } from '@constants/index';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import { LogType } from '@interfaces/drivers/console-log';
import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import type {
  GatewayEndpointHandler,
  IExpressRequest,
  IGatewayOptions,
  IGatewayParams,
  IHttpException,
  TJsonRPC,
} from '@interfaces/services/i-gateway';
import AbstractMicroservice from '@services/abstract-microservice';

/**
 * Base class for create gateway
 */
class Gateway extends AbstractMicroservice {
  /**
   * Gateway options
   * @protected
   */
  protected options: IGatewayOptions = {
    name: 'gateway',
    version: '1.0.0',
    listener: '0.0.0.0:3000',
    connection: 'http://127.0.0.1:8001', // ijson connection
    isSRV: false,
    infoRoute: '/',
    reqTimeout: 1000 * 15, // 15 seconds
    hasAutoRegistration: true, // auto registration microservices
    batchLimit: 5,
    jsonParams: {},
    eventWorkers: 1,
    eventWorkerTimeout: 1000 * 60 * 30, // 30 min
  };

  /**
   * Registered microservices
   * @private
   */
  private readonly microservices: { [path in string]: GatewayEndpointHandler } = {};

  /**
   * Express app
   * @private
   */
  private readonly express: Express = express();

  /**
   * @constructor
   * @protected
   */
  protected constructor(
    options: Partial<IGatewayOptions> = {},
    params: Partial<IGatewayParams> = {},
  ) {
    super();

    if (Gateway.instance) {
      throw new Error("Don't use the constructor to create this object. Use create instead.");
    }

    this.init(options, params);

    const { beforeRoute, afterRoute } = params;
    const { listener, jsonParams, compressionOptions } = this.options;
    const [, ...route] = listener.split('/');

    this.express.disable('x-powered-by');

    // Enable response compression
    if (compressionOptions !== false) {
      this.express.use(compression(compressionOptions));
    }

    // Parse JSON body request
    this.express.use(express.json(jsonParams));
    beforeRoute?.(this.express);
    // Set gateway request listener
    this.express.post(`/${route.join('/')}`, this.handleClientRequest);
    afterRoute?.(this.express);
    // Convert express errors to JSON-RPC 2.0 format
    this.express.use(Gateway.expressError.bind(this));
  }

  /**
   * Create gateway instance
   */
  static create(options?: Partial<IGatewayOptions>, params?: Partial<IGatewayParams>): Gateway {
    if (!Gateway.instance) {
      Gateway.instance = new this(options, params);
    }

    return Gateway.instance as Gateway;
  }

  /**
   * Get microservice instance
   */
  static getInstance(): Gateway {
    return Gateway.instance as Gateway;
  }

  /**
   * Get express instance
   */
  public getExpress(): Express {
    return this.express;
  }

  /**
   * Add microservice
   */
  public addMicroservice(name: string, handler: GatewayEndpointHandler = null): Gateway {
    this.microservices[name] = handler;

    return this;
  }

  /**
   * Remove microservice
   */
  public removeMicroservice(name: string): Gateway {
    _.unset(this.microservices, name);

    return this;
  }

  /**
   * Express error response handler
   * Convert errors to JSON-RPC 2.0
   * @private
   */
  private static expressError(
    err: IHttpException,
    req: Request & { service?: string },
    res: Response,
    // not works without next function parameter
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    __: NextFunction,
  ) {
    const error = new BaseException({
      status: err.status || err.statusCode || 500,
      code: err.code || EXCEPTION_CODE.PARSE_ERROR,
      message: err.message,
      service: err.service ?? req.service,
    });

    res.json(new MicroserviceResponse({ error }));
  }

  /**
   * Validate client request body
   * @private
   */
  private validateRequest(request: IExpressRequest['body']): MicroserviceResponse | undefined {
    // Validate correct parse json
    if (!request || typeof request !== 'object') {
      return new MicroserviceResponse({
        error: this.getException({
          code: EXCEPTION_CODE.PARSE_ERROR,
          message: 'Parse error',
          status: 500,
        }),
      });
    }

    // Validate batch request
    if (Array.isArray(request)) {
      if (request.length === 0) {
        return new MicroserviceResponse({
          error: this.getException({
            code: EXCEPTION_CODE.INVALID_REQUEST,
            message: 'Invalid Request',
            status: 500,
          }),
        });
      }

      // Check batch limit
      if (request.length > this.options.batchLimit) {
        return new MicroserviceResponse({
          error: this.getException({
            code: EXCEPTION_CODE.INVALID_REQUEST,
            message: 'Invalid Request (batch limit exceeded)',
            status: 500,
          }),
        });
      }

      const hasInvalidRequest = request.some((r) => !r || typeof r !== 'object');

      if (hasInvalidRequest) {
        return new MicroserviceResponse({
          error: this.getException({
            code: EXCEPTION_CODE.INVALID_REQUEST,
            message: 'Batch contains invalid request',
            status: 500,
          }),
        });
      }
    }

    return undefined;
  }

  /**
   * Handle client request
   * Express request handler
   */
  private handleClientRequest = async (req: IExpressRequest, res: Response): Promise<void> => {
    const { body, headers } = req;

    const invalidRequest = this.validateRequest(body);

    if (invalidRequest) {
      res.json(invalidRequest);

      return;
    }

    let response;

    if (!Array.isArray(body)) {
      response = await this.microserviceRequest(body, req);
    } else {
      const id = `${(body[0].id as string) || ''}-batch`;

      this.logDriver(() => `Batch request: ${body.length} (${id}).`, LogType.REQ_EXTERNAL, id);

      response = await Promise.all(body.map((b) => this.microserviceRequest(b, req)));

      if (headers?.type === 'async') {
        response = undefined;
      }

      this.logDriver(() => `End batch request: ${body.length} (${id}).`, LogType.RES_EXTERNAL, id);
    }

    (Array.isArray(response) ? response : [response]).forEach((msRes) => {
      const reqPayload = msRes?.getResult()?.payload;
      const cookies = reqPayload?.cookies;

      // cookie manipulations
      if (Array.isArray(cookies)) {
        _.unset(reqPayload, 'cookies');

        cookies.forEach((cookie) => {
          const { action, name, value, options } = cookie;

          switch (action) {
            case 'add':
              res.cookie(name, value, options ?? {});
              break;
            case 'remove':
              res.clearCookie(name, options ?? {});
          }
        });
      }

      // remove performance payload
      if (reqPayload?.performance) {
        _.unset(msRes?.getResult(), 'payload.performance');
      }

      // remove payload key if it empties
      if (reqPayload && Object.keys(reqPayload).length === 0) {
        _.unset(msRes?.getResult(), 'payload');
      }
    });

    res.json(response);
  };

  /**
   * Send client request to microservice
   * @private
   */
  private async microserviceRequest(
    body: TJsonRPC,
    req: IExpressRequest,
  ): Promise<MicroserviceResponse> {
    const { headers } = req;

    // Validate JSON-RPC 2.0 standard
    const isInvalidId = !['string', 'number', 'undefined'].includes(typeof body.id);
    const isInvalidMethod = !['string'].includes(typeof body.method);
    const isInvalidParams =
      !['object', 'undefined'].includes(typeof body.params) || Array.isArray(body.params);

    if (isInvalidId || isInvalidMethod || isInvalidParams) {
      return new MicroserviceResponse({
        id: !isInvalidId ? body.id : undefined,
        error: this.getException({
          code: isInvalidParams ? EXCEPTION_CODE.INVALID_PARAMS : EXCEPTION_CODE.INVALID_REQUEST,
          message: 'The JSON sent is not a valid JSON-RPC 2.0 request',
          status: 500,
        }),
      });
    }

    _.set(body, 'params.payload.sender', 'client');
    _.set(body, 'params.payload.isInternal', false);
    _.set(body, 'params.payload.headers', headers);

    const request = new MicroserviceRequest(body);
    const [microservice] = request.getMethod().split('.');
    const clientHandler = this.microservices[microservice];

    // Checking for microservice existence
    if (!microservice || (clientHandler === undefined && !this.options.hasAutoRegistration)) {
      return new MicroserviceResponse({
        id: request.getId(),
        error: this.getException({
          code: EXCEPTION_CODE.MICROSERVICE_NOT_FOUND,
          message: `Microservice "${microservice}" not found`,
          status: 404,
        }),
      });
    }

    const response = new MicroserviceResponse({ id: request.getId() });

    try {
      this.logDriver(
        () => `request --> ${request.getMethod()} / ${request.getId()!}`,
        LogType.REQ_EXTERNAL,
        `${request.getId()!}-gateway`,
      );

      const reqParams = await this.applyMiddlewares({ task: request }, req);
      const reqArgs = [
        request.getMethod(),
        reqParams,
        {
          isInternal: false,
          reqId: request.getId(),
          logPadding: '',
          reqParams: {
            headers: {
              ...(headers?.type === 'async' ? { type: headers.type } : { Option: 'if present' }),
            },
            timeout: this.options.reqTimeout,
          },
        },
      ] as Required<Parameters<typeof Gateway.prototype.sendRequest>>;
      const resResult = (await clientHandler?.(...reqArgs)) ?? (await this.sendRequest(...reqArgs));
      const result = await this.applyMiddlewares(
        { task: request, result: resResult.getResult() },
        req,
        MiddlewareType.response,
      );

      this.logDriver(
        () => `response --> ${request.getMethod()} / ${request.getId()!}`,
        LogType.RES_EXTERNAL,
        `${request.getId()!}-gateway`,
      );

      response.setResult(result);

      return response;
    } catch (e) {
      if (e instanceof BaseException) {
        response.setError(e);
      } else {
        response.setError(
          this.getException({
            code: EXCEPTION_CODE.GATEWAY_HANDLER_EXCEPTION,
            message: e.message,
            status: 500,
          }),
        );
      }

      return response;
    }
  }

  /**
   * Run microservice
   */
  public start(): Promise<void | void[]> {
    const { name, version, listener, infoRoute, eventWorkers } = this.options;
    const [host, port] = listener.split(':');

    this.logDriver(() => `${name} start. Version: ${version}`, LogType.INFO);

    if (infoRoute) {
      this.express.get(infoRoute, (req: Request, res: Response) => {
        res.send(`${name} - available - version: ${version}`);
      });
    }

    const server = this.express.listen(Number(port), host, () =>
      this.logDriver(
        () => `Client listener "${name}" started on: ${listener}. Version: ${version}`,
        LogType.INFO,
      ),
    );

    return this.startWorkers(1, eventWorkers).then(() => {
      server.close();
    });
  }
}

export default Gateway;
