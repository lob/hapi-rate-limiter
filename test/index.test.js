'use strict';

const expect = require('chai').expect;

const Bluebird        = require('bluebird');
const createBoomError = require('create-boom-error');
const hapi            = require('@hapi/hapi');
const Redis           = require('redis');
const Sinon           = require('sinon');

const Authentication  = require('./authentication.js');
const HapiRateLimiter = require('../lib');

Bluebird.promisifyAll(Redis.RedisClient.prototype);
Bluebird.promisifyAll(Redis.Multi.prototype);

const redisClient = Redis.createClient({
  port: process.env.REDIS_PORT || '6379',
  host: process.env.REDIS_HOST || 'localhost'
});

after(() => {
  redisClient.quit();
});

const RateLimitError = createBoomError(
  'RateLimitExceeded',
  429,
  (rate) => `Rate limit exceeded. Please wait ${rate.window} seconds and try your request again.`
);

describe('plugin', async () => {

  const shortLimitRate = { limit: 1, window: 60 };
  const shortWindowRate = { limit: 10, window: 1 };
  const defaultRate = { limit: 10, window: 60 };
  let returnedRedisError;
  let time;

  const server = new hapi.Server({ port: 0 });

  await server.register([
    Authentication,
    {
      plugin: HapiRateLimiter,
      options: {
        defaultRate: () => defaultRate,
        redisClient,
        key: (request) => request.auth.credentials.api_key,
        overLimitError: (rate) => new RateLimitError(rate),
        onRedisError: (err) => {
          returnedRedisError = err;
        },
        timer: (ms) => {
          time = ms;
        }
      }
    }]);

  server.route([{
    method: 'POST',
    path: '/default_test',
    config: {
      plugins: {
        rateLimit: {
          enabled: true
        }
      },
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
      }
    }
  },
  {
    method: 'POST',
    path: '/default_no_headers',
    config: {
      plugins: {
        rateLimit: {
          enabled: true,
          noHeaders: true
        }
      },
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
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
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
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
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
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
          key: () => 'custom'
        }
      },
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
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
          keyPrefix: () => 'custom-prefix'
        }
      },
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
      }
    }
  },
  {
    method: 'POST',
    path: '/auth_enabled_test',
    config: {
      auth: {
        strategies: ['basic']
      },
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
      }
    }
  },
  {
    method: 'POST',
    path: '/disabled_test',
    config: {
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
      }
    }
  },
  {
    method: 'PUT',
    path: '/put_test',
    config: {
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
      }
    }
  }]);

  before(async () => {
    // Normally we don't listen on ports in unit tests. However, this package has an
    // `onPreStart` stage that we need to honor. So, it listens on `0`, meaning a random
    // high port. Note that previously the server.start() code listened on port 80 and
    // would fail silently.
    await server.start();
  });

  after(async () => {
    await server.stop();
  });

  beforeEach(async () => {
    await redisClient.flushdb();
  });

  afterEach(() => {
    returnedRedisError = undefined;
    time = undefined;
    Sinon.restore();
  });

  it('counts number of requests made', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/default_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    });

    expect(response.result.rate.remaining).to.eql(defaultRate.limit - 1);
  });

  it('ignores everything except GET, POST, and DELETE requests', () => {
    return server.inject({
      method: 'PUT',
      url: '/put_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate).to.not.exist;
      });
  });

  it('ignores rate-limit disabled routes', () => {
    return server.inject({
      method: 'POST',
      url: '/disabled_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate).to.not.exist;
      });
  });

  it('sets custom rate given', () => {
    return server.inject({
      method: 'POST',
      url: '/short_limit_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
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
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate.limit).to.eql(defaultRate.limit);
        expect(response.result.rate.window).to.eql(defaultRate.window);
      });
  });

  it('uses custom key function if provided', () => {
    return server.inject({
      method: 'POST',
      url: '/custom_rate_limit_key_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate.limit).to.eql(defaultRate.limit);
        expect(response.result.rate.window).to.eql(defaultRate.window);
        return redisClient.getAsync('hapi-rate-limiter:post:/custom_rate_limit_key_test:custom');
      })
      .then((result) => {
        expect(result).to.equal('1');
      });
  });

  it('uses default key if none provided', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate.limit).to.eql(defaultRate.limit);
        expect(response.result.rate.window).to.eql(defaultRate.window);
        return redisClient.getAsync('hapi-rate-limiter:post:/default_test:123');
      })
      .then((result) => {
        expect(result).to.equal('1');
      });
  });

  it('uses custom keyPrefix function if provided', () => {
    return server.inject({
      method: 'POST',
      url: '/custom_rate_limit_key_prefix_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate.limit).to.eql(defaultRate.limit);
        expect(response.result.rate.window).to.eql(defaultRate.window);
        return redisClient.getAsync('hapi-rate-limiter:custom-prefix:123');
      })
      .then((result) => {
        expect(result).to.equal('1');
      });
  });

  it('uses default keyPrefix if no custom keyPrefix is registered for the route and no keyPrefix is set in the plugin options', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate.limit).to.eql(defaultRate.limit);
        expect(response.result.rate.window).to.eql(defaultRate.window);
        return redisClient.getAsync('hapi-rate-limiter:post:/default_test:123');
      })
      .then((result) => {
        expect(result).to.equal('1');
      });
  });

  it('blocks requests over limit', () => {
    return server.inject({
      method: 'POST',
      url: '/short_limit_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then(() => {
        return server.inject({
          method: 'POST',
          url: '/short_limit_test',
          auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
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
        return server.inject({
          method: 'POST',
          url: '/short_window_test',
          auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
        });
      })
      .then((response) => {
        expect(response.result.rate.reset).to.eql(now + shortWindowRate.window);
        expect(response.result.rate.remaining).to.eql(shortWindowRate.limit - 1);
      })
      .delay(shortWindowRate.window * 1000)
      .then(() => {
        return server.inject({
          method: 'POST',
          url: '/short_window_test',
          auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
        });
      })
      .then((response) => {
        expect(response.result.rate.remaining).to.eql(shortWindowRate.limit - 1);
      });
  });

  it('has different counts for different api_keys', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      auth: {
        credentials: { api_key: '456' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate.remaining).to.eql(defaultRate.limit - 1);
      })
      .then(() => {
        return server.inject({
          method: 'POST',
          url: '/default_test',
          payload: {
            loaded: false
          },
          auth: {
            credentials: { api_key: '789' },
            strategy: 'basic'
          }
        });
      })
      .then((response) => {
        expect(response.result.rate.remaining).to.eql(defaultRate.limit - 1);
      });
  });

  it('sets the appropriate headers', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.headers).to.contain.all.keys(['x-rate-limit-reset', 'x-rate-limit-limit', 'x-rate-limit-remaining']);
      });
  });

  it('allows to not returns the headers', () => {
    return server.inject({
      method: 'POST',
      url: '/default_no_headers',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.headers).to.not.contain.all.keys(['x-rate-limit-reset', 'x-rate-limit-limit', 'x-rate-limit-remaining']);
      });
  });

  it('ignores requests with invalid auth credentials', () => {
    return server.inject({
      method: 'POST',
      url: '/auth_enabled_test'
    })
      .then((response) => {
        expect(response.headers).to.not.contain.all.keys(['x-rate-limit-reset', 'x-rate-limit-limit', 'x-rate-limit-remaining']);
      });
  });

  it('calls onRedisError if the Redis client errors', () => {
    const err = new Error('SomeError');
    Sinon.stub(redisClient, 'evalshaAsync').rejects(new Error('SomeError')).usingPromise(Bluebird.Promise);

    return server.inject({
      method: 'POST',
      url: '/default_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then(() => {
        expect(returnedRedisError.message).to.eql(err.message);
      });
  });

  it('calls timer with the number of milliseconds the rate limit operation took', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then(() => {
        expect(time).to.be.greaterThan(0);
        expect(time).to.be.lessThan(20);
      });
  });

  it('continues the request even if onRedisError is not set', () => {
    const testServer = new hapi.Server({ port: 0 });

    testServer.register([
      Authentication,
      {
        plugin: HapiRateLimiter,
        options: {
          defaultRate: () => ({ limit: 1, window: 60 }),
          redisClient,
          key: (request) => request.auth.credentials.api_key,
          overLimitError: (rate) => new RateLimitError(rate)
        }
      }
    ]);

    testServer.route([{
      method: 'GET',
      path: '/test',
      config: {
        plugins: {
          rateLimit: {
            enabled: true
          }
        },
        handler: () => {
          return 'hello world';
        }
      }
    }]);

    Sinon.stub(redisClient, 'evalshaAsync').returns(Bluebird.reject('SomeError'));

    return testServer.inject({
      method: 'GET',
      url: '/test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result).to.eql('hello world');
      });
  });

});

describe('register plugin with keyPrefix option set so rate limit is common to all routes', async () => {

  const defaultRate = { limit: 10, window: 60 };

  const server = new hapi.Server({ port: 0 });

  await server.register([
    Authentication,
    {
      plugin: HapiRateLimiter,
      options: {
        defaultRate: () => defaultRate,
        redisClient,
        key: (request) => request.auth.credentials.api_key,
        keyPrefix: () => 'options-prefix',
        overLimitError: (rate) => new RateLimitError(rate)
      }
    }
  ]);

  server.route([{
    method: 'POST',
    path: '/default_test',
    config: {
      plugins: {
        rateLimit: {
          enabled: true
        }
      },
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
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
      handler: (request) => {
        return { rate: request.plugins['hapi-rate-limiter'].rate };
      }
    }
  }]);

  before(async () => {
    await server.start();
  });

  after(async () => {
    await server.stop();
  });

  beforeEach(async () => {
    await redisClient.flushdb();
  });

  it('uses keyPrefix from options if no custom keyPrefix is registered for the route', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate.limit).to.eql(defaultRate.limit);
        expect(response.result.rate.window).to.eql(defaultRate.window);
        return redisClient.getAsync('hapi-rate-limiter:options-prefix:123');
      })
      .then((result) => {
        expect(result).to.equal('1');
      });
  });

  it('has a single limit for all routes requested with the same credentials', () => {
    return server.inject({
      method: 'POST',
      url: '/default_test',
      auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
    })
      .then((response) => {
        expect(response.result.rate.remaining).to.eql(defaultRate.limit - 1);
        return server.inject({
          method: 'GET',
          url: '/another_route',
          auth: {
        credentials: { api_key: '123' },
        strategy: 'basic'
      }
        });
      })
      .then((response) => {
        expect(response.result.rate.remaining).to.eql(defaultRate.limit - 2);
      });
  });

});
