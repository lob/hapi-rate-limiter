'use strict';

const HapiAuthBasic = require('hapi-auth-basic');

exports.register = async (server) => {
  await server.register(HapiAuthBasic);

  server.auth.strategy('basic', 'basic', {
    validate: async (request, username, password, h) => {
      return { isValid: username === 'lob' };
    }
  });
};

exports.name = 'faux-auth';
