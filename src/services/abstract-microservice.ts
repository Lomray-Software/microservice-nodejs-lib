import type { Agent } from 'http';
import http from 'http';
import axios from 'axios';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { EXCEPTION_CODE, PROCESS_EXIT_EVENT_TYPES } from '@constants/index';
import BaseException from '@core/base-exception';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import ConsoleLog from '@drivers/console-log';
import ResolveSrv from '@helpers/resolve-srv';
import WaitSec from '@helpers/wait-sec';
import type IBaseException from '@interfaces/core/i-base-exception';
import type { IEventRequest } from '@interfaces/core/i-event-request';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import { LogDriverType, LogType } from '@interfaces/drivers/console-log';
import type {
  IAbstractMicroserviceOptions,
  IAbstractMicroserviceParams,
  IEndpointHandler,
  IEndpointHandlerOptions,
  IEndpoints,
  IEventHandler,
  IInnerRequestParams,
  IMiddlewareParams,
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
  protected logDriver: LogDriverType = ConsoleLog();

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
   * @private
   */
  private eventHandlers: { [eventName: string]: IEventHandler[] } = {};

  /**
   * Microservice channel prefix
   * @private
   */
  private readonly channelPrefix = 'ms';

  /**
   * Event channel prefix
   * @private
   */
  private readonly eventChannelPrefix = 'events';

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
   * Get event channel prefix
   */
  public getEventChannelPrefix(): string {
    return this.eventChannelPrefix;
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
   * Get microservice endpoints
   */
  public getEndpoints(): IEndpoints {
    return this.endpoints;
  }

  /**
   * Remove microservice endpoint
   */
  public removeEndpoint(path: string): AbstractMicroservice {
    _.unset(this.endpoints, path);

    return this;
  }

  /**
   * Add new event handler
   */
  public addEventHandler(eventName: string, handler: IEventHandler): AbstractMicroservice {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }

    this.eventHandlers[eventName].push(handler);

    return this;
  }

  /**
   * Get microservice event handlers
   */
  public getEventHandlers(): AbstractMicroservice['eventHandlers'] {
    return this.eventHandlers;
  }

  /**
   * Remove event handler
   */
  public removeEventHandler(channel: string, handler: IEventHandler): AbstractMicroservice {
    const index = (this.eventHandlers[channel] ?? []).indexOf(handler);

    if (index !== -1) {
      this.eventHandlers[channel].splice(index, 1);
    }

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

          process.exit(Number(eventOrExitCodeOrError) || 1);
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
   *
   * params.match - only specific methods (* - allow all)
   */
  public addMiddleware(
    handler: MiddlewareHandler,
    type: MiddlewareType = MiddlewareType.request,
    params: Partial<IMiddlewareParams> = {},
  ): AbstractMicroservice {
    this.middlewares[type].push({ handler, params: { match: '*', exclude: [], ...params } });

    return this;
  }

  /**
   * Remove middleware
   */
  public removeMiddleware(handler: MiddlewareHandler): AbstractMicroservice {
    for (const type in MiddlewareType) {
      const index = _.find(this.middlewares[type], { handler });

      if (index !== undefined) {
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

    for (const {
      handler,
      params: { match, exclude },
    } of this.middlewares[type]) {
      const shouldSkip =
        !data.task.getMethod().startsWith(match.replace('*', '')) ||
        exclude.includes(data.task.getMethod());

      handledParams = (!shouldSkip && (await handler(data, request))) || handledParams;
    }

    return handledParams;
  }

  /**
   * Get list of registered microservices
   */
  public async lookup(
    isOnlyAvailable = false,
    channelPrefix: string = this.getChannelPrefix(),
  ): Promise<string[]> {
    const ijsonConnection = await this.getConnection();
    const { data } = await axios.request({ url: `${ijsonConnection}/rpc/details` });
    const prefix = `${channelPrefix}/`;

    return Object.entries(data ?? {}).reduce(
      (res: string[], [channel, params]: [string, Record<string, any>]) => {
        if (
          channel.startsWith(prefix) &&
          (!isOnlyAvailable || (params?.worker_ids?.length ?? 0) > 0)
        ) {
          res.push(channel.replace(prefix, ''));
        }

        return res;
      },
      [],
    );
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

    this.logDriver(
      () => `<-- to ${receiver}: ${response.toString()}`,
      LogType.RES_INTERNAL,
      taskId,
    );

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

            response.setResult(result || resResult || {});
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
   * Start event worker
   * @protected
   */
  protected async runEventWorker(num: number): Promise<void> {
    const eventNames = Object.keys(this.eventHandlers).join(',');

    // don't run event worker if subscribers has not exist
    if (eventNames.length === 0) {
      return;
    }

    this.logDriver(
      () => `${this.options.name} - start event worker ${num}: ${eventNames}`,
      LogType.INFO,
    );

    const { eventWorkerTimeout, name } = this.options;

    while (true) {
      try {
        const { data } = await axios.request<IEventRequest>({
          url: `/${this.eventChannelPrefix}/${name}`,
          baseURL: await this.getConnection(),
          method: 'POST',
          headers: {
            type: 'get',
          },
          // default timeout needs for obtain new channels (e.g. which add dynamically)
          timeout: eventWorkerTimeout,
        });

        const sender = data?.payload?.sender ?? 'unknown';
        const eventName = data?.payload?.eventName;

        this.logDriver(
          () => `<-- event ${eventName as string} from ${sender}: ${JSON.stringify(data)}`,
          LogType.INFO,
        );

        if (!eventName) {
          continue;
        }

        Object.entries(this.eventHandlers).forEach(([eventHandlersName, handlers]) => {
          if (
            eventHandlersName === eventName ||
            eventName.startsWith(eventHandlersName.replace('*', ''))
          ) {
            handlers.forEach((handler) => {
              void handler(data, { app: this, sender });
            });
          }
        });
      } catch (e) {
        // Could not connect to ijson or channel
        if (e.message === 'socket hang up' || e.message.includes('ECONNREFUSED')) {
          throw e;
        }

        this.logDriver(() => `event worker error: ${e?.message as string}`, LogType.ERROR);
        await WaitSec(5);
      }
    }
  }

  /**
   * Publish event
   * All connected workers receive the message
   */
  public static async eventPublish<TParams>(
    eventName: string,
    params?: IEventRequest<TParams>,
  ): Promise<number | string> {
    const ms = this.instance;
    const {
      options: { name },
      eventChannelPrefix,
    } = ms;

    ms.logDriver(() => `--> send event ${eventName}: ${JSON.stringify(params)}`, LogType.INFO);

    try {
      const listeners = await ms.lookup(false, eventChannelPrefix);
      let sentCount = 0;

      for (const listener of listeners) {
        try {
          const { status } = await axios.request<never, never, IEventRequest>({
            url: `/${eventChannelPrefix}/${listener}`,
            baseURL: await ms.getConnection(),
            method: 'POST',
            data: {
              ...(params || {}),
              payload: {
                sender: name,
                eventName,
              },
            },
            headers: {
              type: 'async',
            },
            timeout: 1000 * 60, // Request timeout 1 min
          });

          if (status === 200) {
            sentCount += 1;
          }
        } catch (e) {
          // ignore sending
          ms.logDriver(
            () =>
              `--> failed send event for listener ${listener} on ${eventName}: ${
                e.message as string
              }`,
            LogType.ERROR,
          );
        }
      }

      return sentCount;
    } catch (e) {
      ms.logDriver(
        () => `--> failed send event ${eventName}: ${e.message as string}`,
        LogType.ERROR,
      );

      return e.message;
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
    const {
      isInternal = true,
      shouldGenerateId = true,
      reqId,
      logPadding = '  ',
      reqParams = {},
    } = params;
    const requestParams = { ...data };
    const sender = this.options.name;

    _.set(requestParams, 'payload.sender', sender);
    _.set(requestParams, 'payload.senderStack', [...(data.payload?.senderStack ?? []), sender]);
    _.set(requestParams, 'payload.isInternal', isInternal);

    const request = new MicroserviceRequest({
      ...(shouldGenerateId || reqId ? { id: reqId ?? uuidv4() } : {}),
      method: endpoint.join('.'),
      params: requestParams,
    });

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

      // Handle unregistered microservice case
      if (!result && reqParams.headers?.Option === 'if present') {
        throw this.getException({
          message: `Microservice "${microservice}" not found`,
          status: 404,
          code: EXCEPTION_CODE.MICROSERVICE_NOT_FOUND,
        });
      }

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
        () =>
          `${logPadding}<-- to ${isInternal ? 'client' : sender}: ${
            response.toString() ?? 'async (notification?)'
          }`,
        LogType.RES_EXTERNAL,
        request.getId(),
      );
    }
  }

  /**
   * Start microservice workers (task listeners)
   * @protected
   */
  protected startWorkers(count: number, eventCount: number): Promise<void | void[]> {
    const { name } = this.options;

    const workers = _.times(count, (num) => this.runWorker(num + 1));
    const eventWorkers = _.times(eventCount, (num) => this.runEventWorker(num + 1));

    return Promise.all([...workers, ...eventWorkers]).catch((e) =>
      this.logDriver(() => `${name} shutdown: ${e.message as string}`, LogType.ERROR),
    );
  }
}

export default AbstractMicroservice;
