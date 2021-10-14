import { MiddlewareType } from '@interfaces/services/i-abstract-microservice';
import { RemoteMiddlewareActionType } from '@interfaces/services/i-remote-middleware';
import Gateway from '@services/gateway';
import Microservice from '@services/microservice';

/**
 * 1. Create microservice with name 'demo'
 * 2. add 'test' endpoint handler
 * 3. add before/after remote middleware endpoint handlers
 * 4. register remote middleware
 */
const microservice = Microservice.create({
  name: 'demo',
});

microservice.addEndpoint('test', ({ hello }) => ({ success: true, hello }));
microservice.addEndpoint(
  'before-remote-middleware',
  ({
    task: {
      params: { hello },
    },
  }) => ({
    hello: `${hello as string} + before middleware`,
    middleware: 'before',
  }),
);
microservice.addEndpoint('after-remote-middleware', ({ result }) => ({
  ...result,
  middleware: 'after',
}));

// Register remote middleware (before)
void microservice.getRemoteMiddlewareService().registerRemote('gateway', {
  action: RemoteMiddlewareActionType.ADD,
  method: 'before-remote-middleware',
});
// Register remote middleware (after)
void microservice.getRemoteMiddlewareService().registerRemote('gateway', {
  action: RemoteMiddlewareActionType.ADD,
  method: 'after-remote-middleware',
  options: { type: MiddlewareType.response },
});

/**
 * 1. Create gateway
 * 2. register 'demo' microservice
 */
const gateway = Gateway.create();

gateway.addMicroservice('demo');

// start microservices
void gateway.start();
void microservice.start();
