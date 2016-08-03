'use strict';

exports.register = (server, options, next) => {

  server.ext('onPostAuth', (request, reply) => {
    request.plugins['hapi-rate-limiter'] = { rate: null };

    if (!(request.route.method === 'get' || request.route.method === 'post' || request.route.method === 'delete')) {
      return reply.continue();
    }

    const routeSettings = request.route.settings.plugins.rateLimit;
    if (!routeSettings || !routeSettings.enabled) {
      return reply.continue();
    }

    const rate = routeSettings.rate ? routeSettings.rate(request) : options.defaultRate(request);

    const key = `hapi-rate-limiter:${request.route.method}:${request.route.path}:${options.requestAPIKey(request)}`;
    options.redisClient.multi();
    options.redisClient.set(key, 0, 'EX', rate.window, 'NX'); // if key not found, insert key:0 with window seconds expiry
    options.redisClient.incr(key);
    options.redisClient.ttl(key);

    return options.redisClient.exec()
    .then((results) => {
      const remaining = rate.limit - results[1];

      rate.remaining = Math.max(remaining, 0);
      rate.reset = Math.floor(new Date().getTime() / 1000) + results[2];
      request.plugins['hapi-rate-limiter'].rate = rate;

      if (remaining < 0) {
        return reply(new options.overLimitError(rate));
      }

      return reply.continue();
    });

  });

  server.ext('onPreResponse', (request, reply) => {

    const rate = request.plugins['hapi-rate-limiter'] ? request.plugins['hapi-rate-limiter'].rate : null;

    if (rate) {
      // if an error was thrown, set headers on error-response instead
      const headers = request.response.output ? request.response.output.headers : request.response.headers;

      headers['X-Rate-Limit-Remaining'] = rate.remaining;
      headers['X-Rate-Limit-Limit'] = rate.limit;
      headers['X-Rate-Limit-Reset'] = rate.reset;
    }

    return reply.continue();
  });

  next();

};

exports.register.attributes = {
  name: 'hapi-rate-limiter'
};
