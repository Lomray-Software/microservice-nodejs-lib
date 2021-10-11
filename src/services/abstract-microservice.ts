import type { Agent } from 'http';
import http from 'http';
import axios from 'axios';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { EXCEPTION_CODE, PROCESS_EXIT_EVENT_TYPES } from '@constants/index';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import ConsoleLogDriver from '@drivers/console-log';
import ResolveSrv from '@helpers/resolve-srv';
import type IBaseException from '@interfaces/core/i-base-exception';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import { LogDriverType, LogType } from '@interfaces/drivers/log-driver';
import type {
  IInnerRequestParams,
  ProcessExitHandler,
  MiddlewareData,
  MiddlewareHandler,
  IMiddlewares,
  MiddlewareClientRequest,
} from '@interfaces/services/i-abstract-microservice';
import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';

/**
 * Base class for implementation common methods
 */
abstract class AbstractMicroservice {
  /**
   * @type {Microservice}
   */
  protected static instance: AbstractMicroservice;

  /**
   * Microservice options
   * @protected
   */
  protected options: Record<string, any> & { name: string };

  /**
   * Microservice log driver
   * @private
   */
  protected logDriver: LogDriverType = ConsoleLogDriver;

  /**
   * Common request http agent
   * @private
   */
  protected httpAgent: Agent = new http.Agent({ keepAlive: true });

  /**
   * Cache connection if it SRV record
   * @private
   */
  private cachedConnection: string;

  /**
   * Request middlewares
   * @private
   */
  private middlewares: IMiddlewares = {
    [MiddlewareType.request]: [],
    [MiddlewareType.response]: [],
  };

  /**
   * Initialize microservice
   * @protected
   */
  protected init(
    options: Partial<Record<string, any>>,
    params: Partial<Record<string, any>>,
  ): void {
    // use pickBy for disallow remove options
    this.options = { ...this.options, ..._.pickBy(options) };

    const { logDriver } = params;

    // Change log driver
    if (logDriver !== undefined && logDriver !== true) {
      // Set custom log driver or disable logging
      this.logDriver = logDriver === false ? () => undefined : logDriver;
    }
  }

  /**
   * Return connection string or resolve SRV record and return connection string.
   */
  public async getConnection(): Promise<string> {
    const { isSRV, connection } = this.options;

    if (isSRV) {
      if (this.cachedConnection) {
        return this.cachedConnection;
      }

      return (this.cachedConnection = await ResolveSrv(connection));
    }

    return connection;
  }

  /**
   * Add process exit handler
   * E.g. for close DB connection and etc.
   */
  public onExit(handler: ProcessExitHandler): void {
    PROCESS_EXIT_EVENT_TYPES.forEach((eventType) => {
      process.once(eventType, (eventOrExitCodeOrError) => {
        void (async () => {
          try {
            await handler(eventOrExitCodeOrError);
          } catch (e) {
            this.logDriver(
              () => `Process killed with error: ${e.message as string}`,
              LogType.ERROR,
            );
          }

          process.exit(
            Number.isNaN(Number(eventOrExitCodeOrError)) ? 1 : Number(eventOrExitCodeOrError),
          );
        })();
      });
    });
  }

  /**
   * Create microservice exception
   */
  public getException(props: Partial<IBaseException>): BaseException {
    return new BaseException({
      ...props,
      service: this.options.name,
    });
  }

  /**
   * Add microservice request middleware
   */
  public addMiddleware(
    middleware: MiddlewareHandler,
    type: MiddlewareType = MiddlewareType.request,
  ): AbstractMicroservice {
    this.middlewares[type].push(middleware);

    return this;
  }

  /**
   * Apply middlewares to request or response
   * @private
   */
  protected async applyMiddlewares(
    data: MiddlewareData,
    request: MiddlewareClientRequest,
    type: MiddlewareType = MiddlewareType.request,
  ): Promise<IMicroserviceRequest['params']> {
    // Change request params or response result
    let handledParams = type === MiddlewareType.request ? data.task.getParams() : data.result;

    for (const middleware of this.middlewares[type]) {
      handledParams = (await middleware(data, request)) || handledParams;
    }

    return handledParams;
  }

  /**
   * Send request to another microservice
   */
  public async sendRequest(
    method: string,
    data: MicroserviceRequest['params'] = {},
    params: IInnerRequestParams = {},
  ): Promise<MicroserviceResponse> {
    const [microservice, ...endpoint] = method.split('.');
    const { shouldGenerateId = true, reqId, reqParams = {} } = params;

    const request = new MicroserviceRequest({
      ...(shouldGenerateId || reqId ? { id: reqId ?? uuidv4() } : {}),
      method: endpoint.join('.'),
      params: _.merge(data, { payload: { sender: `${this.options.name} - (service)` } }),
    });

    this.logDriver(
      () => `  --> Request (${microservice} - ${request.getId() ?? 0}): ${request.toString()}`,
      LogType.IN_EXTERNAL,
      request.getId(),
    );

    const time = Date.now();
    let responseLog = '';

    try {
      const connection = await this.getConnection();
      const { data: result } = await axios.request({
        timeout: 1000 * 60 * 5, // Request timeout 5 min
        ...reqParams,
        url: `${connection}/${microservice}`,
        method: 'POST',
        data: request,
      });

      // Keep empty for notification request
      responseLog = (result.error || result.result) && JSON.stringify(result);

      if (result.error) {
        // Keep original service name
        throw new BaseException(result.error);
      }

      return new MicroserviceResponse(result);
    } catch (e) {
      // Error from try block (throw original microservice error)
      if (e instanceof BaseException) {
        responseLog = e.toString();

        throw e;
      }

      const isDown = e.response?.status === 404;
      const error = this.getException({
        code: EXCEPTION_CODE.MICROSERVICE_DOWN,
        message: isDown ? `Microservice "${microservice}" is down.` : e.message,
        status: isDown ? 404 : 500,
      });

      responseLog = error.toString();

      throw error;
    } finally {
      const reqTime = Date.now() - time;

      this.logDriver(
        () =>
          `  <-- Response (${microservice} - ${request.getId() ?? 0}) ${reqTime} ms: ${
            responseLog || 'empty (notification?)'
          }.`,
        LogType.OUT_EXTERNAL,
        request.getId(),
      );
    }
  }
}

export default AbstractMicroservice;
