import MicroserviceResponse from '@core/microservice-response';
import { LogType } from '@interfaces/drivers/log-driver';
import { AutoRegistrationAction } from '@interfaces/services/i-gateway';
import type {
  IAutoRegisterParams,
  IMicroserviceOptions,
  IMicroserviceParams,
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

    const { autoRegistrationGateway } = this.options;

    if (autoRegistrationGateway) {
      void this.gatewayRegister(autoRegistrationGateway);
    }
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
  public start(): Promise<void | void[]> {
    const { name, version, workers } = this.options;

    this.logDriver(() => `${name} started. Version: ${version}`, LogType.INFO);

    return this.startWorkers(workers);
  }
}

export default Microservice;
