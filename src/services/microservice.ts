import _ from 'lodash';
import { LogType } from '@interfaces/drivers/log-driver';
import type {
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
    isRemoteMiddlewareEndpoint: true,
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
