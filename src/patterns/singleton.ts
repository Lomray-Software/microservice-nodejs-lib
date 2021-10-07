type AnyObject = Record<string, any> | undefined;

/**
 * Singleton pattern implementation
 */
class Singleton {
  /**
   * @type {Singleton}
   */
  protected static instance: Singleton;

  /**
   * @constructor
   * @protected
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected constructor(..._params: AnyObject[]) {
    // close constructor

    if (Singleton.instance) {
      throw new Error("Don't use the constructor to create this object. Use getInstance instead.");
    }
  }

  /**
   * Create/get singleton instance
   */
  public static getInstance(...params: AnyObject[]): Singleton {
    if (!this.instance) {
      this.instance = new this(...params);
    }

    return this.instance;
  }
}

export default Singleton;
