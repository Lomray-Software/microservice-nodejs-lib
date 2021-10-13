import _ from 'lodash';
import ConsoleLogDriver from '@drivers/console-log';
import { LogDriverType, LogType } from '@interfaces/drivers/log-driver';
import type { MiddlewareHandler } from '@interfaces/services/i-abstract-microservice';
import type {
  IRemoteMiddlewareEndpointParams,
  IRemoteMiddlewareParams,
  IRemoteMiddlewareReqParams,
} from '@interfaces/services/i-remote-middleware';
import { RemoteMiddlewareActionType } from '@interfaces/services/i-remote-middleware';
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
   * Service log driver
   * @private
   */
  protected logDriver: LogDriverType = ConsoleLogDriver;

  /**
   * @constructor
   */
  constructor(microservice: AbstractMicroservice, params: Partial<IRemoteMiddlewareParams> = {}) {
    this.microservice = microservice;

    const { logDriver } = params;

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
      'middlewares',
      ({ action, method, options }) => {
        if (action === RemoteMiddlewareActionType.ADD) {
          this.add(method, options);
        } else if (action === RemoteMiddlewareActionType.REMOVE) {
          this.remove(method);
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
}

export default RemoteMiddleware;
