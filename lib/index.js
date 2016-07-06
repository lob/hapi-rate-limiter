'use strict';

exports.register = (server, options, next) => {

  server.ext('onPostAuth', (request, reply) => {
    request.payload.loaded = true;

    return reply.continue();
  });

  next();

};

exports.register.attributes = {
  name: 'hapi-rate-limit'
};
