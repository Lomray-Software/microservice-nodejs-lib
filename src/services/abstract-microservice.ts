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
  IAbstractMicroserviceOptions,
  IAbstractMicroserviceParams,
  IEndpointHandler,
  IEndpointHandlerOptions,
  IEndpoints,
  IInnerRequestParams,
  IMiddlewares,
  ITask,
  MiddlewareClientRequest,
  MiddlewareData,
  MiddlewareHandler,
  ProcessExitHandler,
} from '@interfaces/services/i-abstract-microservice';
import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';

/**
 * Base class for implementation common methods
 */
abstract class AbstractMicroservice {
  /**
   * @type {Microservice}
   * @protected
   */
  protected static instance: AbstractMicroservice;

  /**
   * Microservice options
   * @protected
   */
  protected options: IAbstractMicroserviceOptions;

  /**
   * Microservice log driver
   * @private
   */
  protected logDriver: LogDriverType = ConsoleLogDriver;

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
   * @private
   */
  private endpoints: IEndpoints = {};

  /**
   * Microservice channel prefix
   * @private
   */
  private readonly channelPrefix = 'ms';

  /**
   * Initialize microservice
   * @protected
   */
  protected init(
    options: Partial<IAbstractMicroserviceOptions>,
    params: Partial<IAbstractMicroserviceParams>,
  ): void {
    // use omitBy for disallow remove options
    this.options = { ...this.options, ..._.omitBy(options, _.isUndefined.bind(_)) };

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
   * Get channel prefix
   */
  public getChannelPrefix(): string {
    return this.channelPrefix;
  }

  /**
   * Add microservice endpoint
   */
  public addEndpoint<TParams = Record<string, any>, TPayload = Record<string, any>>(
    path: string,
    handler: IEndpointHandler<TParams, TPayload>,
    options: Partial<IEndpointHandlerOptions> = {},
  ): AbstractMicroservice {
    this.endpoints[path] = {
      handler,
      options: { isDisableMiddlewares: false, isPrivate: false, ...options },
    };

    return this;
  }

  /**
   * Remove microservice endpoint
   */
  public removeEndpoint(path: string): AbstractMicroservice {
    _.unset(this.endpoints, path);

    return this;
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
   * Add request/response middleware
   */
  public addMiddleware(
    middleware: MiddlewareHandler,
    type: MiddlewareType = MiddlewareType.request,
  ): AbstractMicroservice {
    this.middlewares[type].push(middleware);

    return this;
  }

  /**
   * Remove middleware
   */
  public removeMiddleware(handler: MiddlewareHandler): AbstractMicroservice {
    for (const type in MiddlewareType) {
      const index = this.middlewares[type].indexOf(handler);

      if (index !== -1) {
        this.middlewares[type].splice(index, 1);

        break;
      }
    }

    return this;
  }

  /**
   * Apply middlewares to request or response
   * @protected
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
   * Get task from queue
   * @protected
   */
  protected async getTask(httpAgent: Agent, response?: MicroserviceResponse): Promise<ITask> {
    const { name } = this.options;

    try {
      const req = await axios.request<IMicroserviceRequest>({
        url: !response ? `/${this.channelPrefix}/${name}` : undefined,
        baseURL: await this.getConnection(),
        method: 'POST',
        data: response,
        httpAgent,
        headers: {
          type: 'worker',
        },
      });

      const task = new MicroserviceRequest(req.data);
      const taskSender = task.getParams()?.payload?.sender ?? 'client';

      this.logDriver(
        () => `--> from ${taskSender}: ${task.toString()}`,
        LogType.REQ_INTERNAL,
        task.getId(),
      );

      return { task, req };
    } catch (e) {
      // Could not connect to ijson or channel
      if (e.message === 'socket hang up' || e.message.includes('ECONNREFUSED')) {
        throw e;
      }

      const task = new MicroserviceResponse({
        id: response?.getId(),
        error: this.getException({ message: e.message }),
      });

      return { task, req: e.response };
    }
  }

  /**
   * Send result of processing the task and get new task from queue
   * @protected
   */
  protected sendResponse(
    response: MicroserviceResponse,
    httpAgent: Agent,
    task: MicroserviceRequest | MicroserviceResponse,
  ): Promise<ITask> {
    const taskId = response.getId();
    const receiver =
      task instanceof MicroserviceRequest ? task.getParams()?.payload?.sender ?? 'queue' : 'queue';

    this.logDriver(() => `<-- to ${receiver} ${response.toString()}`, LogType.RES_INTERNAL, taskId);

    return this.getTask(httpAgent, response);
  }

  /**
   * Start queue worker
   * @protected
   */
  protected async runWorker(num: number): Promise<void> {
    this.logDriver(() => `${this.options.name} - start worker: ${num}.`, LogType.INFO);

    const httpAgent = new http.Agent({ keepAlive: true });

    let { task, req } = await this.getTask(httpAgent);

    while (true) {
      const response = new MicroserviceResponse({ id: task.getId() });

      // Response error
      if (task instanceof MicroserviceResponse) {
        response.setError(task.getError());
      } else {
        // Handle request
        const {
          handler,
          options: { isDisableMiddlewares, isPrivate },
        } = this.endpoints[task.getMethod()] ?? { options: {} };

        if (!handler || (isPrivate && !task.getParams()?.payload?.isInternal)) {
          response.setError(
            this.getException({
              code: EXCEPTION_CODE.METHOD_NOT_FOUND,
              status: 404,
              message: `Unknown method: ${task.getMethod()}`,
            }),
          );
        } else {
          try {
            // Apply before middleware if enabled
            const reqParams =
              (!isDisableMiddlewares && (await this.applyMiddlewares({ task }, req))) ||
              task.getParams();
            const resResult = await handler((reqParams as Record<string, any>) ?? {}, {
              app: this,
              sender: task.getParams()?.payload?.sender,
              req,
            });
            // Apply after middleware if enabled
            const result =
              !isDisableMiddlewares &&
              (await this.applyMiddlewares(
                { task, result: resResult },
                req,
                MiddlewareType.response,
              ));

            response.setResult(result || resResult);
          } catch (e) {
            response.setError(
              this.getException({
                message: `Endpoint exception (${task.getMethod()}): ${e.message as string}`,
                code: e.code ?? EXCEPTION_CODE.ENDPOINT_EXCEPTION,
                status: e.status ?? 500,
                payload: e.payload ?? null,
              }),
            );
          }
        }
      }

      ({ task, req } = await this.sendResponse(response, httpAgent, task));
    }
  }

  /**
   * Send request to another microservice
   */
  public async sendRequest<
    TRequestParams = Record<string, any>,
    TResponseResult = Record<string, any>,
  >(
    method: string,
    data: MicroserviceRequest<TRequestParams | Record<string, any>>['params'] = {},
    params: IInnerRequestParams = {},
  ): Promise<MicroserviceResponse<TResponseResult>> {
    const [microservice, ...endpoint] = method.split('.');
    const { shouldGenerateId = true, reqId, logPadding = '  ', reqParams = {} } = params;

    const request = new MicroserviceRequest({
      ...(shouldGenerateId || reqId ? { id: reqId ?? uuidv4() } : {}),
      method: endpoint.join('.'),
      params: _.merge(data, { payload: { sender: this.options.name, isInternal: true } }),
    });
    const sender = data.payload?.sender ?? 'client';

    this.logDriver(
      () => `${logPadding}--> to ${microservice}: ${request.toString()}`,
      LogType.REQ_EXTERNAL,
      request.getId(),
    );

    const response = new MicroserviceResponse<TResponseResult>({ id: request.getId() });

    try {
      const connection = await this.getConnection();
      const { data: result } = await axios.request({
        timeout: 1000 * 60 * 5, // Request timeout 5 min
        ...reqParams,
        url: `${connection}/${this.channelPrefix}/${microservice}`,
        method: 'POST',
        data: request,
      });

      if (result.error) {
        // Keep original service name
        throw new BaseException(result.error);
      }

      response.setResult(result.result);

      return response;
    } catch (e) {
      let error = e;

      if (!(error instanceof BaseException)) {
        const isDown = e.response?.status === 404;

        error = this.getException({
          code: EXCEPTION_CODE.MICROSERVICE_DOWN,
          message: isDown ? `Microservice "${microservice}" is down.` : e.message,
          status: isDown ? 404 : 500,
        });
      }

      response.setError(error);

      throw error;
    } finally {
      this.logDriver(
        () => `${logPadding}<-- to ${sender}: ${response.toString() ?? 'async (notification?)'}`,
        LogType.RES_EXTERNAL,
        request.getId(),
      );
    }
  }

  /**
   * Start microservice workers (task listeners)
   * @protected
   */
  protected startWorkers(count: number): Promise<void | void[]> {
    const { name } = this.options;

    return Promise.all(_.times(count, (num) => this.runWorker(num + 1))).catch((e) =>
      this.logDriver(() => `${name} shutdown: ${e.message as string}`, LogType.ERROR),
    );
  }
}

export default AbstractMicroservice;
