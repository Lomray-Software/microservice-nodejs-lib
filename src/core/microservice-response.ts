import type {
  IMicroserviceResponse,
  IMicroserviceResponseJson,
} from '@interfaces/core/i-microservice-response';

/**
 * JSON RPC response class
 */
class MicroserviceResponse<TParams = Record<string, any>, TPayload = Record<string, any>> {
  /**
   * Response identity
   *
   * @private
   */
  private id: IMicroserviceResponse['id'];

  /**
   * Response result
   *
   * @private
   */
  private result: IMicroserviceResponse<TParams, TPayload>['result'];

  /**
   * Response error
   *
   * @private
   */
  private error: IMicroserviceResponse['error'];

  /**
   * @constructor
   */
  constructor(props: IMicroserviceResponse = {}) {
    Object.assign(this, props);
  }

  /**
   * Get response identity
   */
  getId(): IMicroserviceResponse['id'] {
    return this.id;
  }

  /**
   * Get response method
   */
  getResult(): IMicroserviceResponse<TParams, TPayload>['result'] {
    return this.result;
  }

  /**
   * Set response result
   */
  setResult(result: IMicroserviceResponse<TParams, TPayload>['result']): void {
    this.result = result;
  }

  /**
   * Get response error
   */
  getError(): IMicroserviceResponse['error'] {
    return this.error;
  }

  /**
   * Set response error
   */
  setError(error: IMicroserviceResponse['error']): void {
    this.error = error;
  }

  /**
   * Convert microservice response to string
   */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  /**
   * Convert microservice response to json
   */
  toJSON(): IMicroserviceResponseJson {
    if (!this.result && !this.error) {
      return;
    }

    return {
      jsonrpc: '2.0',
      ...(this.id ? { id: this.id } : {}),
      ...(this.result ? { result: this.result } : {}),
      ...(this.error ? { error: this.error } : {}),
    };
  }
}

export default MicroserviceResponse;
