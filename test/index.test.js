'use strict';

const expect   = require('chai').expect;
const Hapi     = require('hapi');
const Sinon    = require('sinon');

const RateLimiters = require('../lib/rate-limiters');

const okRate = {
  window: 60,
  limit: 1,
  current: 0,
  over: false
};

const overRate = {
  window: 60,
  limit: 1,
  current: 2,
  over: true
};

describe('plugin', () => {

  let server;

  beforeEach(() => {
    server = new Hapi.Server();

    server.connection({ port: 80 });

    server.route([{
      method: 'POST',
      path: '/testOk',
      config: {
        handler: (request, reply) => {
          reply(request.payload);
        }
      }
    },
    {
      method: 'POST',
      path: '/testOver',
      config: {
        handler: (request, reply) => {
          reply(request.payload);
        }
      }
    },
    {
      method: 'POST',
      path: '/testNone',
      config: {
        handler: (request, reply) => {
          reply(request.payload);
        }
      }
    }]);

    Sinon.stub(RateLimiters, 'register').returns({
      '/testOk:post': (req, res) => res(null, okRate),
      '/testOver:post': (req, res) => res(null, overRate)
    });
  });

  it('should show rate limit headers for live user and return HTTP 200', () => {
    server.register([
      require('../lib')
    ], () => { });

    return server.inject({
      method: 'POST',
      url: '/testOk',
      credentials: {}
    })
    .then((res) => {
      expect(res.headers).to.contain.all.keys(['rate-limit-window', 'rate-limit-limit', 'rate-limit-remaining']);
      expect(res.statusCode).to.eql(200);

      RateLimiters.register.restore();
    });
  });

  it('should execute handler once over limit', () => {
    server.register([{
      register: require('../lib'),
      options: {
        RateLimitExceeded: (rate) => {
          expect(rate).to.eql(overRate);
          return new Error('');
        }
      }
    }], () => { });

    return server.inject({
      method: 'POST',
      url: '/testOver',
      credentials: {}
    })
    .then(() => {
      RateLimiters.register.restore();
    });
  });

  it('should skip if no limiter available', () => {
    server.register([
      require('../lib')
    ], () => { });

    return server.inject({
      method: 'POST',
      url: '/testNone',
      credentials: {}
    })
    .then((res) => {
      expect(res.headers).to.not.contain.all.keys(['rate-limit-remaining', 'rate-limit-limit', 'rate-limit-window']);
      expect(res.statusCode).to.eql(200);

      RateLimiters.register.restore();
    });
  });

});
