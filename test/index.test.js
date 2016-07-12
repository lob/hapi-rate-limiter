'use strict';

const expect = require('chai').expect;

const Bluebird        = require('bluebird');
const createBoomError = require('create-boom-error');
const Hapi            = require('hapi');
const Redis           = require('then-redis');

const redisClient = Redis.createClient({
  port: '6379',
  host: 'localhost'
});

describe('plugin', () => {

  const shortLimitRate = { limit: 1, window: 60 };
  const shortWindowRate = { limit: 10, window: 1 };
  const defaultRate = { limit: 10, window: 60 };

  const server = new Hapi.Server();

  server.connection({ port: 80 });
  server.route([{
    method: 'POST',
    path: '/default_test',
    config: {
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limit'].rate });
      }
    }
  },
  {
    method: 'POST',
    path: '/short_limit_test',
    config: {
      plugins: {
        rateLimit: shortLimitRate
      },
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limit'].rate });
      }
    }
  },
  {
    method: 'POST',
    path: '/short_window_test',
    config: {
      plugins: {
        rateLimit: shortWindowRate
      },
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limit'].rate });
      }
    }
  },
  {
    method: 'POST',
    path: '/disabled_test',
    config: {
      plugins: {
        rateLimit: {
          enabled: false
        }
      },
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limit'].rate });
      }
    }
  },
  {
    method: 'PUT',
    path: '/put_test',
    config: {
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limit'].rate });
      }
    }
  }]);

  server.register([{
    register: require('../lib'),
    options: {
      defaultRate,
      redisClient,
      overLimitError: (rate) => createBoomError('RateLimitExceeded', 429, `Rate limit exceeded. Please wait ${rate.window} seconds and try your request again.`)
    }
  }], () => {});

  beforeEach(() => {
    return redisClient.flushdb();
  });

  it('counts number of requests made', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.current).to.eql(1);
    });
  });

  it('ignores everything except GET, POST, and DELETE requests', () => {
    return server.inject({
      method: 'PUT',
      url: '/put_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate).to.not.exist;
    });
  });

  it('ignores rate-limit disabled routes', () => {
    return server.inject({
      method: 'POST',
      url: '/disabled_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate).to.not.exist;
    });
  });

  it('sets custom rate given', () => {
    return server.inject({
      method: 'POST',
      url: '/short_limit_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.limit).to.eql(shortLimitRate.limit);
      expect(response.result.rate.window).to.eql(shortLimitRate.window);
    });
  });

  it('sets default rate if none provided', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.limit).to.eql(defaultRate.limit);
      expect(response.result.rate.window).to.eql(defaultRate.window);
    });
  });

  it('blocks requests over limit', () => {
    return server.inject({
      method: 'POST',
      url: '/short_limit_test',
      credentials: { api_key: '123' }
    })
    .then(() => {
      return server.inject({
        method: 'POST',
        url: '/short_limit_test',
        credentials: { api_key: '123' }
      });
    })
    .then((response) => {
      expect(response.statusCode).to.eql(429);
    });
  });

  it('resets current value after window timeout', () => {
    return Bluebird.resolve()
    .then(() => {
      return server.inject({
        method: 'POST',
        url: '/short_window_test',
        credentials: { api_key: '123' }
      });
    })
    .then((response) => {
      expect(response.result.rate.current).to.eql(1);
    })
    .delay(shortWindowRate.window * 1000)
    .then(() => {
      return server.inject({
        method: 'POST',
        url: '/short_window_test',
        credentials: { api_key: '123' }
      });
    })
    .then((response) => {
      expect(response.result.rate.current).to.eql(1);
    });
  });

  it('has different counts for different api_keys', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '456' }
    })
    .then((response) => {
      expect(response.result.rate.current).to.eql(1);
    })
    .then(() => {
      return server.inject({
        method: 'POST',
        url: '/default_test',
        payload: {
          loaded: false
        },
        credentials: { api_key: '789' }
      });
    })
    .then((response) => {
      expect(response.result.rate.current).to.eql(1);
    });
  });

});
