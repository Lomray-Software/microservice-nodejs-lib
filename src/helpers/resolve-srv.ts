import dns from 'dns';
import _ from 'lodash';

/**
 * Resolve srv record and return first host+port (sorted by priority and weight)
 * Default protocol: http
 * You can pass srv record with protocol: https://service-name.local
 * E.g. ECS service with srv record (service discovery endpoint).
 */
const ResolveSrv = (srvRecord: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const [protocol, host] = srvRecord.split('://');

    dns.resolveSrv(host || protocol, (err, addresses) => {
      if (err) {
        return reject(err);
      }

      const sortedAddresses = _.orderBy(addresses, ['priority', 'weight'], ['asc', 'desc']);
      const resolvedHost = sortedAddresses[0]?.name ?? '';
      const resolvedPort = sortedAddresses[0]?.port ?? '';

      if (!resolvedHost) {
        return reject('Unable to resolve srv record: empty list.');
      }

      return resolve(`${host ? `${protocol}://` : ''}${resolvedHost}:${resolvedPort}`);
    });
  });

export default ResolveSrv;
