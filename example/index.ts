import Gateway from '@services/gateway';
import Microservice from '@services/microservice';

// Create microservice with name 'demo', add 'test' endpoint handler
const microservice = Microservice.create({
  name: 'demo',
});

microservice.addEndpoint('test', ({ hello }) => ({ success: true, hello }));

// Create gateway, register 'demo' microservice
const gateway = Gateway.create();

gateway.addMicroservice('demo');
gateway.start();

void microservice.start();
