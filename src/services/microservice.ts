import { LogType } from '@interfaces/drivers/console-log';
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
   * @protected
   */
  protected options: IMicroserviceOptions = {
    name: 'sample',
    version: '1.0.0',
    connection: 'http://127.0.0.1:8001', // ijson connection
    isSRV: false,
    workers: 1,
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
   * Get microservice instance
   */
  static getInstance(): Microservice {
    return Microservice.instance as Microservice;
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
