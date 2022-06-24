/**
 * Microservices data
 */
interface IEventRequestPayload {
  sender?: string;
  eventName: string;
}

type PayloadExtends<TParams> = TParams & IEventRequestPayload;

type IEventRequest<TParams = Record<string, any>, TPayload = Record<string, any>> = TParams & {
  payload?: PayloadExtends<TPayload>;
};

export { IEventRequest, IEventRequestPayload };
