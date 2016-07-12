'use strict';

const Hapi = require('hapi');

describe('plugin', () => {

  const server = new Hapi.Server();
  server.connection({ port: 80 });

  server.register([
    require('../lib')
  ], (err) => {
    if (err) {
      throw err;
    }
  });

  it('loads successfully', () => {
    server.route([{
      method: 'POST',
      path: '/test',
      config: {
        handler: (request, reply) => {
          reply(request.payload);
        }
      }
    }]);

    return server.inject({
      method: 'POST',
      url: '/test',
      payload: {
        loaded: false
      }
    })
    .then((response) => {
      expect(response.result.loaded).to.be.true;
    });
  });

});
