'use strict';

exports.register = (server, options, next) => {

  server.ext('onPostAuth', (request, reply) => {
    request.plugins['hapi-rate-limit'] = { rate: null };

    if (!(request.route.method === 'get' || request.route.method === 'post' || request.route.method === 'delete')) {
      return reply.continue();
    }

    const rate = Object.assign({}, options.defaultRate);
    const routeSettings = request.route.settings.plugins.rateLimit;

    if (routeSettings) {
      if (routeSettings.enabled === false) {
        return reply.continue();
      }

      rate.limit = routeSettings.limit;
      rate.window = routeSettings.window;
    }

    const key = `hapi-rate-limit:${request.route.method}:${request.route.path}:${request.auth.credentials.api_key}`;
    options.redisClient.multi();
    options.redisClient.set(key, 0, 'EX', rate.window, 'NX'); // if key not found, insert key:0 with window seconds expiry
    options.redisClient.incr(key);
    return options.redisClient.exec()
    .then((results) => {
      rate.current = results[1]; // result of 2nd redis instruction
      request.plugins['hapi-rate-limit'].rate = rate;

      if (rate.current > rate.limit) {
        return reply(new (options.overLimitError(rate)));
      }

      return reply.continue();
    });

  });

  next();

};

exports.register.attributes = {
  name: 'hapi-rate-limit'
};
