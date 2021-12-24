import BaseException from '@core/base-exception';
import Gateway from '@services/gateway';
import Microservice from '@services/microservice';
// import { Gateway, Microservice } from '../lib';

/**
 * 1. Create microservice with name 'demo'
 * 2. add 'test' endpoint handler
 */
const microservice = Microservice.create({
  name: 'demo',
});

microservice.addEndpoint('test', ({ hello }) => ({ success: true, hello }));
microservice.addEndpoint('test-exception', () => {
  throw new BaseException({
    message: 'Oh noo...',
    payload: {
      field: 1,
      field2: [],
    },
  });
});

/**
 * 1. Create gateway (auto registration microservices enabled)
 */
const gateway = Gateway.create();

// auto registration microservices enabled (no need call addMicroservice)
// gateway.addMicroservice('demo');

// start microservices
void gateway.start();
void microservice.start();
