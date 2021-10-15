import Gateway from '@services/gateway';
import Microservice from '@services/microservice';
// import { Gateway, Microservice } from '../lib';

/**
 * 1. Create microservice with name 'demo' (with auto registration at gateway)
 * 2. add 'test' endpoint handler
 * 3. add before/after remote middleware endpoint handlers (for example)
 */
const microservice = Microservice.create({
  name: 'demo',
});

microservice.addEndpoint('test', ({ hello }) => ({ success: true, hello }));

void microservice.addEndpointMiddlewareBefore(
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
void microservice.addEndpointMiddlewareAfter('after-remote-middleware', ({ result }) => ({
  ...result,
  middleware: 'after',
}));

// Register remote middleware (before) (auto register)
// void microservice.getRemoteMiddlewareService().registerRemote('gateway', {
//   action: RemoteMiddlewareActionType.ADD,
//   method: 'before-remote-middleware',
// });
// Register remote middleware (after) (auto register)
// void microservice.getRemoteMiddlewareService().registerRemote('gateway', {
//   action: RemoteMiddlewareActionType.ADD,
//   method: 'after-remote-middleware',
//   options: { type: MiddlewareType.response },
// });

/**
 * 1. Create gateway
 */
const gateway = Gateway.create();

// (auto registration is enabled)
// gateway.addMicroservice('demo');

// start microservices
void gateway.start();
void microservice.start();
