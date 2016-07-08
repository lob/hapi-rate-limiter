'use strict';

const RateLimiters = require('./rate-limiters');

exports.register = (server, options, next) => {

  const limiters = RateLimiters.register(server.table()[0]);

  server.ext('onPostAuth', (request, reply) => {
    const key = `${request.route.path}:${request.method}`;
    const limiter = limiters.hasOwnProperty(key) ? limiters[key] : null;

    if (limiter) {
      return limiter(request, (err, rate) => {

        /* istanbul ignore else */
        if (!err) {
          request.app.header = {
            window: rate.window,
            limit: rate.limit,
            remaining: Math.max(0, rate.limit - rate.current),
            current: rate.current
          };

          if (rate.over) {
            return reply(options.RateLimitExceeded(rate));
          }
        }
        return reply.continue();
      });
    }

    return reply.continue();
  });

  server.ext('onPreResponse', (request, reply) => {
    if (request.app.header) {
      if (request.response.output) {
        request.response.output.headers = {
          'rate-limit-window': request.app.header.window,
          'rate-limit-limit': request.app.header.limit,
          'rate-limit-remaining': Math.max(0, request.app.header.remaining)
        };
      } else {
        request.response.header('rate-limit-window', request.app.header.window);
        request.response.header('rate-limit-limit', request.app.header.limit);
        request.response.header('rate-limit-remaining', request.app.header.remaining);
      }
    }
    return reply.continue();
  });

  next();

};

exports.register.attributes = {
  name: 'hapi-rate-limit'
};
