/* eslint-disable import/prefer-default-export */
// noinspection JSUnusedGlobalSymbols

import sinon from 'sinon';

/**
 * Mocha root hooks
 */
export const mochaHooks = {
  beforeEach(): void {
    if (!console.info?.['resetHistory']) {
      sinon.stub(console, 'info');
    }
  },
  afterAll(): void {
    sinon.restore();
  },
};
