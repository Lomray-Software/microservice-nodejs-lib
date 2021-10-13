import type {
  IAbstractMicroserviceOptions,
  IAbstractMicroserviceParams,
} from '@interfaces/services/i-abstract-microservice';

interface IMicroserviceOptions extends IAbstractMicroserviceOptions {
  version: string;
  workers: number;
}

interface IMicroserviceParams extends IAbstractMicroserviceParams {}

export { IMicroserviceParams, IMicroserviceOptions };
