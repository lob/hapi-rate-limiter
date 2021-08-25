'use strict';

const HapiAuthBasic = require('hapi-auth-basic');

exports.register = (server, options, next) => {
  server.register(HapiAuthBasic);

  server.auth.strategy('basic', 'basic', false, {
    validateFunc: (request, username, password, callback) => {
      callback(null, username === 'lob', {});
    }
  });

  return next();
};

exports.register.attributes = {
  name: 'authentication'
};
