import type {
  IAbstractMicroserviceOptions,
  IAbstractMicroserviceParams,
} from '@interfaces/services/i-abstract-microservice';

interface IMicroserviceOptions extends IAbstractMicroserviceOptions {
  workers: number;
  autoRegistrationGateway: string | null;
}

interface IMicroserviceParams extends IAbstractMicroserviceParams {}

interface IAutoRegisterParams {
  timeout: number;
  shouldCancelRegister: boolean;
}

export { IMicroserviceParams, IMicroserviceOptions, IAutoRegisterParams };
