export interface IChannelInfo {
  [channelName: string]: {
    last_worker: number;
    workers: number;
    clients: number;
    worker_ids: string[];
  };
}
