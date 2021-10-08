import type IBaseException from '@interfaces/core/i-base-exception';

/**
 * Base JSON-RPC exception
 */
class BaseException extends Error {
  /**
   * Error code
   */
  private readonly code: IBaseException['code'] = 0;

  /**
   * Error status
   */
  private readonly status: IBaseException['status'] = 0;

  /**
   * Service name (microservice name or gateway)
   */
  private readonly service: IBaseException['service'] = 'unknown';

  /**
   * Exception payload data
   */
  private readonly payload: IBaseException['payload'];

  /**
   * @constructor
   */
  constructor({ message, ...props }: Partial<IBaseException> = {}) {
    super(message ?? 'Undefined error.');

    Object.setPrototypeOf(this, BaseException.prototype);
    Object.assign(this, props);
  }

  /**
   * Convert error object to string
   */
  public toString(): string {
    return `Error: ${this.message}. Service: ${this.service}. Code: ${this.code}. Status: ${this.status}.`;
  }

  /**
   * Convert error object to json
   */
  public toJSON(): Omit<IBaseException, 'payload'> & { payload?: IBaseException['payload'] } {
    return {
      code: this.code,
      status: this.status,
      service: this.service,
      message: this.message,
      ...(this.payload ? { payload: this.payload } : {}),
    };
  }
}

export default BaseException;
