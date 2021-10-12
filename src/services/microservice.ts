import axios from 'axios';
import _ from 'lodash';
import { EXCEPTION_CODE } from '@constants/index';
import MicroserviceRequest from '@core/microservice-request';
import MicroserviceResponse from '@core/microservice-response';
import type { IMicroserviceRequest } from '@interfaces/core/i-microservice-request';
import { LogType } from '@interfaces/drivers/log-driver';
import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import type {
  IEndpointHandler,
  IMicroserviceOptions,
  IMicroserviceParams,
  ITask,
} from '@interfaces/services/i-microservice';
import AbstractMicroservice from '@services/abstract-microservice';

/**
 * Base class for create microservice
 */
class Microservice extends AbstractMicroservice {
  /**
   * Microservice options
   * @private
   */
  protected options: IMicroserviceOptions = {
    name: 'sample',
    version: '1.0.0',
    connection: 'http://127.0.0.1:8001', // ijson connection
    isSRV: false,
    workers: 1,
  };

  /**
   * @private
   */
  private endpoints: { [path in string]: IEndpointHandler } = {};

  /**
   * @constructor
   * @protected
   */
  protected constructor(
    options: Partial<IMicroserviceOptions> = {},
    params: Partial<IMicroserviceParams> = {},
  ) {
    super();

    if (Microservice.instance) {
      throw new Error("Don't use the constructor to create this object. Use create instead.");
    }

    this.init(options, params);
  }

  /**
   * Create microservice instance
   */
  static create(
    options?: Partial<IMicroserviceOptions>,
    params?: Partial<IMicroserviceParams>,
  ): Microservice {
    if (!Microservice.instance) {
      Microservice.instance = new this(options, params);
    }

    return Microservice.instance as Microservice;
  }

  /**
   * Add microservice endpoint
   */
  public addEndpoint<TParams = Record<string, any>, TPayload = Record<string, any>>(
    path: string,
    handler: IEndpointHandler<TParams, TPayload>,
  ): Microservice {
    this.endpoints[path] = handler;

    return this;
  }

  /**
   * Get task from queue
   * @private
   */
  private async getTask(response?: MicroserviceResponse): Promise<ITask> {
    const { name } = this.options;

    try {
      const req = await axios.request<IMicroserviceRequest>({
        url: !response ? `/${name}` : undefined,
        baseURL: await this.getConnection(),
        method: 'POST',
        data: response,
        httpAgent: this.httpAgent,
        headers: {
          type: 'worker',
        },
      });

      const task = new MicroserviceRequest(req.data);
      const taskId = task.getId();
      const taskSender = task.getParams()?.payload?.sender ?? 'Client';

      this.logDriver(
        () => `--> (${taskId ?? 0}) from ${taskSender}: ${task.toString()}`,
        LogType.REQ_INTERNAL,
        taskId,
      );

      return { task, req, time: Date.now() };
    } catch (e) {
      // Could not connect to ijson or channel
      if (e.message === 'socket hang up' || e.message.includes('ECONNREFUSED')) {
        throw e;
      }

      const task = new MicroserviceResponse({
        id: response?.getId(),
        error: this.getException({ message: e.message }),
      });

      return { task, req: e.response, time: Date.now() };
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
      () => `<-- (${taskId ?? 0}) ${reqTime} ms: ${response.toString()}`,
      LogType.RES_INTERNAL,
      taskId,
    );

    return this.getTask(response);
  }

  /**
   * Start queue worker
   * @private
   */
  private async runWorker(num: number): Promise<void> {
    this.logDriver(() => `${this.options.name} - start worker: ${num}.`, LogType.INFO);

    let { task, req, time } = await this.getTask();

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
            this.getException({
              code: EXCEPTION_CODE.METHOD_NOT_FOUND,
              status: 404,
              message: `Unknown method: ${task.getMethod()}`,
            }),
          );
        } else {
          try {
            const reqParams = await this.applyMiddlewares({ task }, req);
            const resResult = await methodHandler(reqParams as Record<string, any>, {
              app: this,
              req,
            });
            const result = await this.applyMiddlewares(
              { task, result: resResult },
              req,
              MiddlewareType.response,
            );

            response.setResult(result);
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

      ({ task, req, time } = await this.sendResponse(response, time));
    }
  }

  /**
   * Run microservice
   */
  public start(): Promise<void | void[]> {
    const { name, version, workers } = this.options;

    this.logDriver(() => `${name} started. Version: ${version}`, LogType.INFO);

    return Promise.all(_.times(workers, (num) => this.runWorker(num + 1))).catch((e) =>
      this.logDriver(() => `${name} shutdown: ${e.message as string}`, LogType.ERROR),
    );
  }
}

export default Microservice;
