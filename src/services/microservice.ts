import type { Agent } from 'http';
import http from 'http';
import axios from 'axios';
import _ from 'lodash';
import { PROCESS_EXIT_EVENT_TYPES } from '@constants/index';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import ConsoleLogDriver from '@drivers/console-log';
import ResolveSrv from '@helpers/resolve-srv';
import type IBaseException from '@interfaces/core/i-base-exception';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import type {
  EndpointHandler,
  IMicroserviceOptions,
  IMicroserviceParams,
  IMiddlewares,
  ITask,
  MiddlewareData,
  MiddlewareHandler,
  ProcessExitHandler,
} from '@interfaces/services/microservice/i-microservice';
import { MiddlewareType } from '@interfaces/services/microservice/i-microservice';
import type { LogDriverType } from '@interfaces/services/microservice/log-driver';
import { LogType } from '@interfaces/services/microservice/log-driver';
import Singleton from '@patterns/singleton';

/**
 * Base class for create microservice
 */
class Microservice extends Singleton {
  /**
   * Microservice options
   * @private
   */
  protected options: IMicroserviceOptions = {
    name: 'sample',
    version: '1.0.0',
    connection: 'http://127.0.0.1:8001',
    isSRV: false,
    workers: 1,
    timeout: 1000 * 60 * 5, // Request timeout 5 min,
  };

  /**
   * Cache connection if it SRV record
   * @private
   */
  private cachedConnection: string;

  /**
   * Microservice log driver
   * @private
   */
  private readonly logDriver: LogDriverType = ConsoleLogDriver;

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
  private endpoints: { [path in string]: EndpointHandler } = {};

  /**
   * Common request http agent
   * @private
   */
  private httpAgent: Agent = new http.Agent({ keepAlive: true });

  /**
   * @constructor
   * @protected
   */
  protected constructor(
    options?: Partial<IMicroserviceOptions>,
    params?: Partial<IMicroserviceParams>,
  ) {
    super();

    // use pickBy for disallow remove options
    this.options = { ...this.options, ..._.pickBy(options ?? {}) };

    const { logDriver } = params || {};

    // Change log driver
    if (logDriver !== undefined && logDriver !== true) {
      // Set custom log driver or disable logging
      this.logDriver = logDriver === false ? () => null : logDriver;
    }
  }

  /**
   * Create microservice instance
   */
  static create(
    options?: Partial<IMicroserviceOptions>,
    params?: Partial<IMicroserviceParams>,
  ): Microservice {
    return <Microservice>this.getInstance(options, params);
  }

  /**
   * Add microservice endpoint
   */
  public addEndpoint(path: string, handler: EndpointHandler): Microservice {
    this.endpoints[path] = handler;

    return this;
  }

  /**
   * Add microservice request middleware
   */
  public addMiddleware(
    middleware: MiddlewareHandler,
    type: MiddlewareType = MiddlewareType.request,
  ): Microservice {
    this.middlewares[type].push(middleware);

    return this;
  }

  /**
   * Add process exit handler
   * E.g. for close DB connection and etc.
   */
  public onExit(handler: ProcessExitHandler): void {
    PROCESS_EXIT_EVENT_TYPES.forEach((eventType) => {
      process.on(eventType, (eventOrExitCodeOrError) => {
        void (async () => {
          try {
            await handler(eventOrExitCodeOrError);
          } catch (e) {
            console.error('Exit error: ', e);
          }

          process.exit(
            Number.isNaN(Number(eventOrExitCodeOrError)) ? 1 : Number(eventOrExitCodeOrError),
          );
        })();
      });
    });
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
   * Apply middlewares to request or response
   * @private
   */
  private async applyMiddlewares(
    data: MiddlewareData,
    request: ITask['res'],
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
   * Make microservice exception
   */
  public getException(props: Partial<IBaseException>): BaseException {
    return new BaseException({
      ...props,
      service: this.options.name,
    });
  }

  /**
   * Get task from queue
   * @private
   */
  private async getTask(response?: MicroserviceResponse): Promise<ITask> {
    const { name } = this.options;

    try {
      const res = await axios.request<IMicroserviceRequest>({
        url: !response ? `/${name}` : undefined,
        baseURL: await this.getConnection(),
        method: 'POST',
        data: response,
        httpAgent: this.httpAgent,
        headers: {
          type: 'worker',
        },
      });

      const task = new MicroserviceRequest(res.data);
      const taskId = task.getId();
      const taskSender = task.getParams()?.payload?.sender ?? 'Client';

      this.logDriver(
        () => `--> Request (${taskId ?? 0}) from ${taskSender}: ${task.toString()}`,
        LogType.IN_INTERNAL,
        taskId,
      );

      return { task, res, time: Date.now() };
    } catch (e) {
      // Could not connect to ijson or channel
      if (e.message === 'socket hang up') {
        throw e;
      }

      // It maybe response error
      const task = new MicroserviceResponse({
        id: response?.getId(),
        error: this.getException({ message: e.message }),
      });

      return { task, res: e.response, time: Date.now() };
    }
  }

  /**
   * Send result of processing the task and get new task from queue
   * @private
   */
  private sendResponse(response: MicroserviceResponse, time: number) {
    const reqTime = Date.now() - time;
    const taskId = response.getId();

    this.logDriver(
      () => `<-- Response (${taskId ?? 0}) ${reqTime} ms: ${response.toString()}`,
      LogType.OUT_INTERNAL,
      taskId,
    );

    return this.getTask(response);
  }

  /**
   * Start queue worker
   * @private
   */
  private async runWorker(num: number): Promise<void> {
    this.logDriver(() => `Start worker: ${num}.`, LogType.INFO);

    let { task, res, time } = await this.getTask();

    while (true) {
      const response = new MicroserviceResponse({ id: task.getId() });

      // Response error
      if (task instanceof MicroserviceResponse) {
        response.setError(task.getError());
      } else {
        // Handle request
        const methodHandler = this.endpoints[task.getMethod()];

        if (!methodHandler) {
          response.setError(
            new BaseException({
              code: -32601,
              status: 404,
              message: `Unknown method: ${task.getMethod()}`,
            }),
          );
        } else {
          try {
            const reqParams = await this.applyMiddlewares({ task }, res);
            const resResult = await methodHandler(reqParams, { app: this, res });
            const result = await this.applyMiddlewares(
              { task, result: resResult },
              res,
              MiddlewareType.response,
            );

            response.setResult(result);
          } catch (e) {
            response.setError(
              new BaseException({
                message: `Endpoint exception (${task.getMethod()}): ${e.message as string}`,
                code: e?.code ?? -32000,
                status: e?.status ?? 500,
                payload: e?.payload ?? null,
              }),
            );
          }
        }
      }

      ({ task, res, time } = await this.sendResponse(response, time));
    }
  }

  /**
   * Run microservice
   */
  public start(): Promise<void> {
    const { name, version, workers } = this.options;

    this.logDriver(() => `${name} microservice started. Version: ${version}`, LogType.INFO);

    return Promise.all(_.times(workers, (num) => this.runWorker(num)))
      .then(() => this.logDriver(() => 'Workers stopped. Microservice shutdown.', LogType.INFO))
      .catch((e) =>
        this.logDriver(() => `Workers critically stopped: ${e.message as string}`, LogType.ERROR),
      );
  }
}

export default Microservice;
