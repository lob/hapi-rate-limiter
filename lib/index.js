'use strict';

const MS_PER_SECOND = 1e3;
const NS_PER_MS     = 1e6;

const SCRIPT = `
  local current = tonumber(redis.call("incr", KEYS[1]))
  if current == 1 then
    redis.call("expire", KEYS[1], ARGV[1])
  end
  local ttl = redis.call("ttl", KEYS[1])
  return {current, ttl}
`;

let sha;

function isEnabled (routeSettings, request) {
  const method = request.route.method;
  const validMethod = method === 'get' || method === 'post' || method === 'delete';
  const enabled = routeSettings && routeSettings.enabled;

  return validMethod && enabled;
}

function defaultKeyPrefix (request) {
  return `${request.route.method}:${request.route.path}`;
}

function getKey (options, routeSettings, request) {
  const prefixFn = routeSettings.keyPrefix || options.keyPrefix || defaultKeyPrefix;
  const prefix = prefixFn(request);

  const keyFn = routeSettings.key || options.key;
  const key = keyFn(request);

  return `hapi-rate-limiter:${prefix}:${key}`;
}

function getRate (options, routeSettings, request) {
  const rateFn = routeSettings.rate || options.defaultRate;
  return rateFn(request);
}

exports.register = (server, options) => {

  server.ext('onPreStart', async (_server) => {
    sha = await options.redisClient.scriptAsync('LOAD', SCRIPT);
  });

  server.ext('onPostAuth', async (request, h) => {
    let startTime;
    let timeDiff;

    const routeSettings = request.route.settings.plugins.rateLimit;

    request.plugins['hapi-rate-limiter'] = { rate: null };

    if (!isEnabled(routeSettings, request)) {
      return h.continue;
    }

    if (options.timer) {
      startTime = process.hrtime();
    }

    const rate = getRate(options, routeSettings, request);
    const key = getKey(options, routeSettings, request);

    return options.redisClient.evalshaAsync(sha, 1, key, rate.window)
    .then(([count, ttl]) => {
      const remaining = rate.limit - count;

      rate.remaining = Math.max(remaining, 0);
      rate.reset = Math.floor(new Date().getTime() / 1000) + ttl;
      request.plugins['hapi-rate-limiter'].rate = rate;

      if (options.timer) {
        timeDiff = process.hrtime(startTime);
      }

      if (remaining < 0) {
        return options.overLimitError(rate);
      }

      return h.continue;
    })
    .catch((err) => {
      if (options.timer) {
        timeDiff = process.hrtime(startTime);
      }

      // If the Redis call failed, call the onRedisError function,
      // then continue with the request.
      if (options.onRedisError) {
        options.onRedisError(err);
      }

      return h.continue;
    })
    .finally(() => {
      if (options.timer) {
        const milliseconds = timeDiff[0] * MS_PER_SECOND + timeDiff[1] / NS_PER_MS;

        options.timer(milliseconds);
      }
    });
  });

  server.ext('onPreResponse', async (request, h) => {
    const rate = request.plugins['hapi-rate-limiter'] ? request.plugins['hapi-rate-limiter'].rate : null;

    if (rate) {
      // If an error was thrown, set headers on the error-response.
      const headers = request.response.output ? request.response.output.headers : request.response.headers;

      headers['X-Rate-Limit-Remaining'] = rate.remaining;
      headers['X-Rate-Limit-Limit'] = rate.limit;
      headers['X-Rate-Limit-Reset'] = rate.reset;
    }

    return h.continue;
  });
};

exports.pkg = require('../package.json');
