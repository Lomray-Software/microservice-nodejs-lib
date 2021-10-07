import type {
  IMicroserviceRequest,
  IMicroserviceRequestJson,
} from '@interfaces/core/i-microservice-request';

/**
 * JSON RPC request class
 */
class MicroserviceRequest {
  /**
   * Request identity
   *
   * @private
   */
  private id: IMicroserviceRequest['id'];

  /**
   * Request method
   *
   * @private
   */
  private method: IMicroserviceRequest['method'];

  /**
   * Request params
   *
   * @private
   */
  private params: IMicroserviceRequest['params'];

  /**
   * @constructor
   */
  constructor(props: IMicroserviceRequest) {
    Object.assign(this, props);
  }

  /**
   * Get request identity
   */
  getId(): IMicroserviceRequest['id'] {
    return this.id;
  }

  /**
   * Get request method
   */
  getMethod(): IMicroserviceRequest['method'] {
    return this.method;
  }

  /**
   * Get request params
   */
  getParams(): IMicroserviceRequest['params'] {
    return this.params;
  }

  /**
   * Convert microservice request to string
   */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  /**
   * Convert microservice request to json
   */
  toJSON(): IMicroserviceRequestJson {
    return {
      jsonrpc: '2.0',
      ...(this.id ? { id: this.id } : {}),
      method: this.method,
      ...(this.params ? { params: this.params } : {}),
    };
  }
}

export default MicroserviceRequest;
