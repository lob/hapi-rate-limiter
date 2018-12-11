'use strict';

const expect = require('chai').expect;

const Bluebird        = require('bluebird');
const createBoomError = require('create-boom-error');
const Hapi            = require('hapi');
const Redis           = require('redis');
const Sinon           = require('sinon');
Bluebird.promisifyAll(Redis.RedisClient.prototype);
Bluebird.promisifyAll(Redis.Multi.prototype);

const redisClient = Redis.createClient({
  port: '6379',
  host: 'localhost'
});

const RateLimitError = createBoomError('RateLimitExceeded', 429, (rate) => `Rate limit exceeded. Please wait ${rate.window} seconds and try your request again.`);

describe('plugin', () => {

  const shortLimitRate = { limit: 1, window: 60 };
  const shortWindowRate = { limit: 10, window: 1 };
  const defaultRate = { limit: 10, window: 60 };
  let returnedRedisError;

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
        overLimitError: (rate) => new RateLimitError(rate),
        onRedisError: (err) => {
          returnedRedisError = err;
        }
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
    path: '/custom_rate_limit_key_prefix_test',
    config: {
      plugins: {
        rateLimit: {
          enabled: true,
          rateLimitKeyPrefix: () => 'custom-prefix'
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

  before((done) => {
    server.start(() => done());
  });

  after((done) => {
    server.stop(() => done());
  });

  beforeEach(() => {
    return redisClient.flushdb();
  });

  afterEach(() => {
    returnedRedisError = undefined;
    Sinon.restore();
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
      return redisClient.getAsync('hapi-rate-limiter:post:/custom_rate_limit_key_test:custom');
    })
    .then((reply) => {
      expect(reply).to.equal('1');
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
      return redisClient.getAsync('hapi-rate-limiter:post:/default_test:123');
    })
    .then((reply) => {
      expect(reply).to.equal('1');
    });
  });

  it('uses custom rateLimitKeyPrefix function if provided', () => {
    return server.injectThen({
      method: 'POST',
      url: '/custom_rate_limit_key_prefix_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.limit).to.eql(defaultRate.limit);
      expect(response.result.rate.window).to.eql(defaultRate.window);
      return redisClient.getAsync('hapi-rate-limiter:custom-prefix:123');
    })
    .then((reply) => {
      expect(reply).to.equal('1');
    });
  });

  it('uses default rateLimitKeyPrefix if no custom rateLimitKeyPrefix is registered for the route and no rateLimitKeyPrefix is set in the plugin options', () => {
    return server.injectThen({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.limit).to.eql(defaultRate.limit);
      expect(response.result.rate.window).to.eql(defaultRate.window);
      return redisClient.getAsync('hapi-rate-limiter:post:/default_test:123');
    })
    .then((reply) => {
      expect(reply).to.equal('1');
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

  it('calls onRedisError if the Redis client errors', () => {
    Sinon.stub(redisClient, 'evalshaAsync').returns(Bluebird.reject('SomeError'));

    return server.injectThen({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then(() => {
      expect(returnedRedisError).to.eql('SomeError');
    });
  });

  it('continues the request even if onRedisError is not set', () => {
    const testServer = new Hapi.Server();

    testServer.connection({ port: 80 });

    testServer.register([
      require('inject-then'),
      require('./authentication'),
      {
        register: require('../lib'),
        options: {
          defaultRate: () => ({ limit: 1, window: 60 }),
          redisClient,
          rateLimitKey: (request) => request.auth.credentials.api_key,
          overLimitError: (rate) => new RateLimitError(rate)
        }
      }
    ], () => {});

    testServer.route([{
      method: 'GET',
      path: '/test',
      config: {
        plugins: {
          rateLimit: {
            enabled: true
          }
        },
        handler: (request, reply) => {
          reply('hello world');
        }
      }
    }]);

    Sinon.stub(redisClient, 'evalshaAsync').returns(Bluebird.reject('SomeError'));

    return testServer.injectThen({
      method: 'GET',
      url: '/test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result).to.eql('hello world');
    });
  });

});

describe('register plugin with rateLimitKeyPrefix option set so rate limit is common to all routes', () => {

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
        rateLimitKeyPrefix: () => 'options-prefix',
        overLimitError: (rate) => new RateLimitError(rate)
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
    method: 'GET',
    path: '/another_route',
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
  }]);

  before((done) => {
    server.start(() => done());
  });

  after((done) => {
    server.stop(() => done());
  });

  beforeEach(() => {
    return redisClient.flushdb();
  });

  it('uses rateLimitKeyPrefix from options if no custom rateLimitKeyPrefix is registered for the route', () => {
    return server.injectThen({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.limit).to.eql(defaultRate.limit);
      expect(response.result.rate.window).to.eql(defaultRate.window);
      return redisClient.getAsync('hapi-rate-limiter:options-prefix:123');
    })
    .then((reply) => {
      expect(reply).to.equal('1');
    });
  });

  it('has a single limit for all routes requested with the same credentials', () => {
    return server.injectThen({
      method: 'POST',
      url: '/default_test',
      credentials: { api_key: '123' }
    })
    .then((response) => {
      expect(response.result.rate.remaining).to.eql(defaultRate.limit - 1);
      return server.injectThen({
        method: 'GET',
        url: '/another_route',
        credentials: { api_key: '123' }
      });
    })
    .then((response) => {
      expect(response.result.rate.remaining).to.eql(defaultRate.limit - 2);
    });
  });

});
