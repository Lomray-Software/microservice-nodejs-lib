import _ from 'lodash';
import MicroserviceResponse from '@core/microservice-response';
import { IMicroserviceRequestJson } from '@interfaces/core/i-microservice-request';
import type { IMicroserviceResponseResult } from '@interfaces/core/i-microservice-response';
import { LogType } from '@interfaces/drivers/log-driver';
import {
  IEndpointHandler,
  IEndpointHandlerOptions,
  MiddlewareType,
} from '@interfaces/services/i-abstract-microservice';
import { AutoRegistrationAction } from '@interfaces/services/i-gateway';
import type {
  IAutoRegisterParams,
  IMicroserviceOptions,
  IMicroserviceParams,
} from '@interfaces/services/i-microservice';
import type { IRemoteMiddlewareRequest } from '@interfaces/services/i-remote-middleware';
import {
  IRegisterRemoteParams,
  RemoteMiddlewareActionType,
} from '@interfaces/services/i-remote-middleware';
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
    hasRemoteMiddlewareEndpoint: true,
    autoRegistrationGateway: 'gateway',
  };

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
   * Add endpoint like middleware (before original endpoint)
   * syntactic sugar
   */
  public addEndpointMiddlewareBefore<TParams = any, TPayload = any>(
    path: string,
    handler: IEndpointHandler<{
      task: IMicroserviceRequestJson<TParams, TPayload>;
      req: IRemoteMiddlewareRequest;
    }>,
    microservice = this.options.autoRegistrationGateway,
    options: Partial<IEndpointHandlerOptions> = {},
    remoteOptions: Partial<IRegisterRemoteParams> = {},
  ): Promise<MicroserviceResponse> {
    if (!microservice) {
      throw new Error('"microservice" is required for add endpoint like remote middleware');
    }

    this.addEndpoint(
      path,
      handler,
      _.merge(options, { isPrivate: true, isDisableMiddlewares: true }),
    );

    return this.remoteMiddlewareService.registerRemote(
      microservice,
      {
        action: RemoteMiddlewareActionType.ADD,
        method: path,
      },
      remoteOptions,
    );
  }

  /**
   * Add endpoint like middleware (after original endpoint)
   * syntactic sugar
   */
  public addEndpointMiddlewareAfter<TParams = any, TPayload = any>(
    path: string,
    handler: IEndpointHandler<{
      task: IMicroserviceRequestJson<TParams, TPayload>;
      result: IMicroserviceResponseResult;
      req: IRemoteMiddlewareRequest;
    }>,
    microservice = this.options.autoRegistrationGateway,
    options: Partial<IEndpointHandlerOptions> = {},
    remoteOptions: Partial<IRegisterRemoteParams> = {},
  ): Promise<MicroserviceResponse> {
    if (!microservice) {
      throw new Error('"microservice" is required for add endpoint like remote middleware');
    }

    this.addEndpoint(
      path,
      handler,
      _.merge(options, { isPrivate: true, isDisableMiddlewares: true }),
    );

    return this.remoteMiddlewareService.registerRemote(microservice, {
      action: RemoteMiddlewareActionType.ADD,
      method: path,
      options: _.merge(remoteOptions, { type: MiddlewareType.response }),
    });
  }

  /**
   * Automatically register microservice at gateway
   */
  public async gatewayRegister(
    gatewayName: string,
    params: Partial<IAutoRegisterParams> = {},
  ): Promise<MicroserviceResponse> {
    const { timeout = 1000 * 60 * 10, shouldCancelRegister = true } = params;

    const result = await this.sendRequest(
      `${gatewayName}.${this.autoRegistrationEndpoint}`,
      { action: AutoRegistrationAction.ADD },
      {
        // timeout 10 min - wait until gateway becomes available
        reqParams: { timeout },
      },
    );

    if (shouldCancelRegister) {
      this.onExit(() => void this.gatewayRegisterCancel(gatewayName));
    }

    return result;
  }

  /**
   * Cancel microservice registration at gateway
   */
  public gatewayRegisterCancel(gatewayName: string, isAsync = true): Promise<MicroserviceResponse> {
    return this.sendRequest(
      `${gatewayName}.${this.autoRegistrationEndpoint}`,
      {
        action: AutoRegistrationAction.REMOVE,
      },
      { reqParams: { headers: isAsync ? { type: 'async' } : {} } },
    );
  }

  /**
   * Run microservice
   */
  public start(): Promise<(void | void[] | MicroserviceResponse)[]> {
    const { name, version, workers, autoRegistrationGateway } = this.options;

    this.logDriver(() => `${name} started. Version: ${version}`, LogType.INFO);

    const workersPool: Promise<void | void[] | MicroserviceResponse>[] = [
      this.startWorkers(workers),
    ];

    if (autoRegistrationGateway) {
      workersPool.push(
        this.gatewayRegister(autoRegistrationGateway).catch((e) =>
          this.logDriver(
            () => `Error auto register at gateway: ${e.message as string}`,
            LogType.ERROR,
          ),
        ),
      );
    }

    return Promise.all(workersPool);
  }
}

export default Microservice;
