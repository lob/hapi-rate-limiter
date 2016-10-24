'use strict';

const expect = require('chai').expect;

const Bluebird        = require('bluebird');
const createBoomError = require('create-boom-error');
const Hapi            = require('hapi');
const Redis           = require('redis');
Bluebird.promisifyAll(Redis.RedisClient.prototype);
Bluebird.promisifyAll(Redis.Multi.prototype);

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

  server.register([
    require('inject-then'),
    require('./authentication'),
    {
      register: require('../lib'),
      options: {
        defaultRate: () => defaultRate,
        redisClient,
        rateLimitKey: (request) => request.auth.credentials.api_key,
        overLimitError: createBoomError('RateLimitExceeded', 429, (rate) => `Rate limit exceeded. Please wait ${rate.window} seconds and try your request again.`)
      }
    }
  ], () => {});

  server.route([{
    method: 'POST',
    path: '/default_test',
    config: {
      plugins: {
        rateLimit: {
          enabled: true
        }
      },
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limiter'].rate });
      }
    }
  },
  {
    method: 'POST',
    path: '/short_limit_test',
    config: {
      plugins: {
        rateLimit: {
          enabled: true,
          rate: () => shortLimitRate
        }
      },
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limiter'].rate });
      }
    }
  },
  {
    method: 'POST',
    path: '/short_window_test',
    config: {
      plugins: {
        rateLimit: {
          enabled: true,
          rate: () => shortWindowRate
        }
      },
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limiter'].rate });
      }
    }
  },
  {
    method: 'POST',
    path: '/custom_rate_limit_key_test',
    config: {
      plugins: {
        rateLimit: {
          enabled: true,
          rateLimitKey: () => 'custom'
        }
      },
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limiter'].rate });
      }
    }
  },
  {
    method: 'POST',
    path: '/auth_enabled_test',
    config: {
      auth: 'basic',
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limiter'].rate });
      }
    }
  },
  {
    method: 'POST',
    path: '/disabled_test',
    config: {
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limiter'].rate });
      }
    }
  },
  {
    method: 'PUT',
    path: '/put_test',
    config: {
      handler: (request, reply) => {
        reply({ rate: request.plugins['hapi-rate-limiter'].rate });
      }
    }
  }]);

  beforeEach(() => {
    return redisClient.flushdb();
  });

  it('counts number of requests made', () => {
    return server.injectThen({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.remaining).to.eql(defaultRate.limit - 1);
    });
  });

  it('ignores everything except GET, POST, and DELETE requests', () => {
    return server.injectThen({
      method: 'PUT',
      url: '/put_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate).to.not.exist;
    });
  });

  it('ignores rate-limit disabled routes', () => {
    return server.injectThen({
      method: 'POST',
      url: '/disabled_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate).to.not.exist;
    });
  });

  it('sets custom rate given', () => {
    return server.injectThen({
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
    return server.injectThen({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.limit).to.eql(defaultRate.limit);
      expect(response.result.rate.window).to.eql(defaultRate.window);
    });
  });

  it('uses custom rateLimitKey function if provided', () => {
    return server.injectThen({
      method: 'POST',
      url: '/custom_rate_limit_key_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.limit).to.eql(defaultRate.limit);
      expect(response.result.rate.window).to.eql(defaultRate.window);
      expect(redisClient.get('custom')).to.exist;
    });
  });

  it('uses default rateLimitKey if none provided', () => {
    return server.injectThen({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.limit).to.eql(defaultRate.limit);
      expect(response.result.rate.window).to.eql(defaultRate.window);
      expect(redisClient.get('123')).to.exist;
    });
  });

  it('blocks requests over limit', () => {
    return server.injectThen({
      method: 'POST',
      url: '/short_limit_test',
      credentials: { api_key: '123' }
    })
    .then(() => {
      return server.injectThen({
        method: 'POST',
        url: '/short_limit_test',
        credentials: { api_key: '123' }
      });
    })
    .then((response) => {
      expect(response.headers).to.contain.all.keys(['x-rate-limit-reset', 'x-rate-limit-limit', 'x-rate-limit-remaining']);
      expect(response.statusCode).to.eql(429);
    });
  });

  it('resets remaining value after window timeout', () => {
    const now = Math.floor(new Date() / 1000);
    return Bluebird.resolve()
    .then(() => {
      return server.injectThen({
        method: 'POST',
        url: '/short_window_test',
        credentials: { api_key: '123' }
      });
    })
    .then((response) => {
      expect(response.result.rate.reset).to.eql(now + shortWindowRate.window);
      expect(response.result.rate.remaining).to.eql(shortWindowRate.limit - 1);
    })
    .delay(shortWindowRate.window * 1000)
    .then(() => {
      return server.injectThen({
        method: 'POST',
        url: '/short_window_test',
        credentials: { api_key: '123' }
      });
    })
    .then((response) => {
      expect(response.result.rate.remaining).to.eql(shortWindowRate.limit - 1);
    });
  });

  it('has different counts for different api_keys', () => {
    return server.injectThen({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '456' }
    })
    .then((response) => {
      expect(response.result.rate.remaining).to.eql(defaultRate.limit - 1);
    })
    .then(() => {
      return server.injectThen({
        method: 'POST',
        url: '/default_test',
        payload: {
          loaded: false
        },
        credentials: { api_key: '789' }
      });
    })
    .then((response) => {
      expect(response.result.rate.remaining).to.eql(defaultRate.limit - 1);
    });
  });

  it('sets the appropriate headers', () => {
    return server.injectThen({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.headers).to.contain.all.keys(['x-rate-limit-reset', 'x-rate-limit-limit', 'x-rate-limit-remaining']);
    });
  });

  it('ignores requests with invalid auth credentials', () => {
    return server.injectThen({
      method: 'POST',
      url: '/auth_enabled_test'
    })
    .then((response) => {
      expect(response.headers).to.not.contain.all.keys(['x-rate-limit-reset', 'x-rate-limit-limit', 'x-rate-limit-remaining']);
    });
  });

});
