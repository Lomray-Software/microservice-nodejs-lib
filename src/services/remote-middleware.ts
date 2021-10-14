import _ from 'lodash';
import MicroserviceResponse from '@core/microservice-response';
import ConsoleLogDriver from '@drivers/console-log';
import { LogDriverType, LogType } from '@interfaces/drivers/log-driver';
import type { MiddlewareHandler } from '@interfaces/services/i-abstract-microservice';
import type {
  IRemoteMiddlewareEndpointParams,
  IRemoteMiddlewareParams,
  IRemoteMiddlewareReqParams,
} from '@interfaces/services/i-remote-middleware';
import {
  IRegisterRemoteParams,
  RemoteMiddlewareActionType,
} from '@interfaces/services/i-remote-middleware';
import AbstractMicroservice from '@services/abstract-microservice';

/**
 * Service for register remote middleware
 */
class RemoteMiddleware {
  /**
   * Microservice instance
   * @private
   */
  private microservice: AbstractMicroservice;

  /**
   * Collect methods handlers for remove in future
   * @private
   */
  private methods: { [method: string]: MiddlewareHandler } = {};

  /**
   * This methods should be cancel registration before microservice shut down
   * @private
   */
  private cancelMiddlewareMethods: string[] = [];

  /**
   * Service log driver
   * @private
   */
  protected logDriver: LogDriverType = ConsoleLogDriver;

  /**
   * Register remote endpoint name
   * @private
   */
  private readonly endpoint: string = 'middlewares';

  /**
   * @constructor
   */
  constructor(microservice: AbstractMicroservice, params: Partial<IRemoteMiddlewareParams> = {}) {
    this.microservice = microservice;

    const { logDriver, endpoint } = params;

    // Change default endpoint
    if (endpoint) {
      this.endpoint = endpoint;
    }

    // Change log driver
    if (logDriver !== undefined && logDriver !== true) {
      // Set custom log driver or disable logging
      this.logDriver = logDriver === false ? () => undefined : logDriver;
    }
  }

  /**
   * Add endpoint for register remote middleware
   * @protected
   */
  public addEndpoint(): void {
    this.microservice.addEndpoint<IRemoteMiddlewareEndpointParams>(
      this.endpoint,
      ({ action, method, options }, { sender }) => {
        if (!sender || !Object.values(RemoteMiddlewareActionType).includes(action)) {
          return { ok: false };
        }

        const endpoint = [sender, method].join('.');

        if (action === RemoteMiddlewareActionType.ADD) {
          this.add(endpoint, options);
          this.logDriver(() => `Remote middleware registered: ${endpoint}`);
        } else {
          this.remove(endpoint);
          this.logDriver(() => `Remote middleware canceled: ${endpoint}`);
        }

        return { ok: true };
      },
      { isDisableMiddlewares: true, isPrivate: true },
    );
  }

  /**
   * Call microservice method like middleware
   */
  public add(method: string, params: IRemoteMiddlewareReqParams = {}): MiddlewareHandler {
    const { type, isRequired = false, reqParams } = params;

    if (!method) {
      throw new Error('"method" is required for register remote middleware.');
    }

    if (this.methods[method]) {
      throw new Error('"method" already registered like remote middleware.');
    }

    const handler = (this.methods[method] = (data, req) => {
      const request = _.pick(req, [
        'status',
        'headers',
        'query',
        'params',
        'statusCode',
        'statusText',
        'httpVersion',
      ]);

      return this.microservice
        .sendRequest(method, { ...data, req: request }, reqParams)
        .then((response) => {
          if (isRequired && response.getError()) {
            throw response.getError();
          }

          return response.getResult();
        })
        .catch((e) => {
          this.logDriver(
            () => `Remote middleware error: ${e.message as string}`,
            LogType.ERROR,
            data.task.getId(),
          );

          if (!isRequired) {
            return;
          }

          throw e;
        });
    });

    this.microservice.addMiddleware(handler, type);

    return handler;
  }

  /**
   * Remove remote middleware
   */
  public remove(method: string): void {
    const handler = this.methods[method];

    if (!handler) {
      return;
    }

    _.unset(this.methods, method);
    this.microservice.removeMiddleware(handler);
  }

  /**
   * Register/cancel middleware on remote microservice
   */
  public async registerRemote(
    microservice: string,
    data: IRemoteMiddlewareEndpointParams,
    params: Partial<IRegisterRemoteParams> = {},
  ): Promise<MicroserviceResponse> {
    const { timeout = 1000 * 60 * 5, shouldCancelRegister = true } = params;

    const result = await this.microservice.sendRequest(`${microservice}.${this.endpoint}`, data, {
      // timeout 5 min - wait until microservice becomes available
      reqParams: { timeout },
    });

    if (shouldCancelRegister) {
      if (data.action === RemoteMiddlewareActionType.ADD) {
        this.cancelMiddlewareMethods.push(`${microservice}|${data.method}`);
      } else if (data.action === RemoteMiddlewareActionType.REMOVE) {
        this.cancelMiddlewareMethods = _.without(
          this.cancelMiddlewareMethods,
          `${microservice}|${data.method}`,
        );
      }
    }

    return result;
  }

  /**
   * Register on exit microservice callback and cancel remote middlewares
   */
  public registerOnExit(): void {
    this.microservice.onExit(() => {
      const requests = this.cancelMiddlewareMethods.map((microserviceAndMethod) => {
        const [microservice, method] = microserviceAndMethod.split('|');

        return this.microservice.sendRequest(
          `${microservice}.${this.endpoint}`,
          {
            action: RemoteMiddlewareActionType.REMOVE,
            method,
          },
          { reqParams: { headers: { type: 'async' } } },
        );
      });

      return Promise.all(requests) as unknown as Promise<void>;
    });
  }
}

export default RemoteMiddleware;
