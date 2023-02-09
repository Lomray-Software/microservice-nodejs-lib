import type IBaseException from '@interfaces/core/i-base-exception';

/**
 * Base JSON-RPC exception
 */
class BaseException extends Error implements IBaseException {
  /**
   * Error code
   */
  readonly code: IBaseException['code'] = 0;

  /**
   * Error status
   */
  readonly status: IBaseException['status'] = 0;

  /**
   * Service name (microservice name or gateway)
   */
  readonly service: IBaseException['service'] = 'unknown';

  /**
   * Exception payload data
   */
  readonly payload: IBaseException['payload'];

  /**
   * @constructor
   */
  constructor({ message, ...props }: Partial<IBaseException> = {}) {
    super(message ?? 'Undefined error.');

    Object.setPrototypeOf(this, BaseException.prototype);
    Object.assign(this, props);

    if (!props.stack) {
      Error.captureStackTrace(this);
    }
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
  public toJSON(): Omit<IBaseException, 'payload' | 'stack'> & {
    payload?: IBaseException['payload'];
  } {
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
