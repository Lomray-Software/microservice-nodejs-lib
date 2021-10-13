import Gateway from '@services/gateway';
import Microservice from '@services/microservice';

/**
 * 1. Create microservice with name 'demo'
 * 2. add 'test' endpoint handler
 */
const microservice = Microservice.create({
  name: 'demo',
});

microservice.addEndpoint('test', ({ hello }) => ({ success: true, hello }));

/**
 * 1. Create gateway
 * 2. register 'demo' microservice
 */
const gateway = Gateway.create();

gateway.addMicroservice('demo');

// start microservices
gateway.start();
void microservice.start();
