import type { Express, Response } from 'express';
import express from 'express';
import { EXCEPTION_CODE } from '@constants/index';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import { LogType } from '@interfaces/drivers/log-driver';
import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import {
  GatewayEndpointHandler,
  IExpressRequest,
  IGatewayOptions,
  IGatewayParams,
} from '@interfaces/services/i-gateway';
import AbstractMicroservice from '@services/abstract-microservice';

/**
 * Base class for create gateway
 */
class Gateway extends AbstractMicroservice {
  /**
   * Gateway options
   * @private
   */
  protected options: IGatewayOptions = {
    name: 'gateway',
    version: '1.0.0',
    listener: '0.0.0.0:3000',
    connection: 'http://127.0.0.1:8001', // ijson connection
    isSRV: false,
    hasInfoRoute: true,
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
  private readonly express: Express;

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

    const [, ...route] = this.options.listener.split('/');

    this.express = express();

    // Set gateway request listener
    this.express.route(`/${route.join('/')}`).post(this.handleClientRequest.bind(this));

    this.express.disable('x-powered-by');
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
   * Handle client request
   * Express request handler
   */
  private async handleClientRequest(req: IExpressRequest, res: Response): Promise<void> {
    const { body, headers } = req;
    const request = new MicroserviceRequest(body);
    const [microservice] = request.getMethod().split('.');
    const clientHandler = this.microservices[microservice];

    // Check registered microservice
    if (clientHandler === undefined) {
      const response = new MicroserviceResponse({
        id: request.getId(),
        error: this.getException({
          code: EXCEPTION_CODE.MICROSERVICE_NOT_FOUND,
          message: `Microservice "${microservice}" not found`,
          status: 404,
        }),
      });

      res.json(response);

      return;
    }

    const response = new MicroserviceResponse({ id: request.getId() });

    try {
      const reqParams = await this.applyMiddlewares({ task: request }, req);
      const resResult = await (clientHandler ?? this.sendRequest.bind(this))(
        request.getMethod(),
        reqParams,
        {
          reqId: request.getId(),
          reqParams: { headers: { ...(headers?.type === 'async' ? { type: headers.type } : {}) } },
        },
      );
      const result = await this.applyMiddlewares(
        { task: request, result: resResult.getResult() },
        req,
        MiddlewareType.response,
      );

      response.setResult(result);

      res.json(response);
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

      res.json(response);
    }
  }

  /**
   * Run microservice
   */
  public start(): void {
    const { name, version, listener } = this.options;
    const [host, port] = listener.split(':');

    this.express.listen(Number(port), host, () =>
      this.logDriver(() => `${name} started on: ${listener}. Version: ${version}`, LogType.INFO),
    );
  }
}

export default Gateway;
