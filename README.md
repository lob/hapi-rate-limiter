# hapi-rate-limiter
A [Hapi](http://hapijs.com/) plugin that enables rate-limiting for GET, POST, and DELETE requests. This plugin can be configured with custom
rates on a route-by-route basis.

## Register the plugin
```
const Bluebird = require('bluebird');
const Hapi     = require('hapi');
const Redis    = require('redis');

Bluebird.promisifyAll(Redis.RedisClient.prototype);
Bluebird.promisifyAll(Redis.Multi.prototype);

const Server = new Hapi.Server();

const RedisClient = Redis.createClient({
  port: '6379',
  host: 'localhost'
});

const defaultRate = {
  limit: 10,
  window: 60
};

server.register({
  register: require('hapi-rate-limiter'),
  options: {
    defaultRate: (request) => defaultRate,
    key: (request) => request.auth.credentials.apiKey,
    redisClient: RedisClient,
    overLimitError: (rate) => new Error(`Rate Limit Exceeded - try again in ${rate.window} seconds`),
    onRedisError: (err) => console.log(err),
    timer: (ms) => console.log(`Rate Limit Latency - ${ms} milliseconds`)
  }
}, (err) => {

});
```

#### Options
The following options are required for the plugin to work properly: `(defaultRate, key, redisClient, overLimitError)`.

The `keyPrefix` option is optional and defaults to: `(request) => request.route.method + ':' + request.route.path;`.

Rate-limiting is by default disabled on all routes, unless `enabled=true` in the route plugin [settings](#custom-rate).

##### `defaultRate`
Function that accepts a `Request` object and returns:
```
{
  limit: # of max requests allows within window (integer)
  window: # of seconds before count resets (integer)
}
```

This is used if there is no `rate` function defined in the route plugin [settings](#custom-rate).

##### `key`
A function that returns a key for a given request. This can be any differentiating value in each request, such as an API Key, IP Address, etc

##### `keyPrefix`
A function that returns a prefix (string) for a given request. The `keyPrefix` is combined with the `key` to look up the rate-limiting information for a given request. By default, the rate limits are enforced on a per route basis. If you want the rate limit to apply to all routes, then return a constant value from this function.

##### `redisClient`
A promisified redis client

##### `overLimitError`
A function that is called when the rate limit is exceeded. It must return an error. It is called with an object `rate` that contains information about the current state of the request rate.

##### `onRedisError`
An optional function that is called when the call to the Redis client errors. It is called with the `err` from the Redis client.

##### `timer`
An optional function that will be called upon every rate limit request. The argument will be the time in milliseconds to perform the rate limit process.

## Managing Routes
Settings for individual routes can be set while registering a route.

#### Custom Rate
A custom `limit` and `window` can be registered for each route. The `rate` key
accepts a `Request` object and returns a [rate](#defaultRate).

```
const customRate = {
  limit: 20,
  window: 30
};

server.route([{
  method: 'POST',
  path: '/custom_rate_route',
  config: {
    plugins: {
      rateLimit: {
        enabled: true
        rate: (request) => customRate
      }
    },
    handler: (request, reply) => {
      reply({ rate: request.plugins['hapi-rate-limiter'].rate });
    }
  }
}]);
```

To enable rate-limiting for a route, `enabled` must be `true` in the route plugin settings.

`rate` can also be defined in these settings to set a custom rate. If this is not defined, `defaultRate` will be used.

`key` and `keyPrefix` can also be defined in these settings to override the values set in the plugin options.

#### Disable Rate-Limiting for route

If `plugins.rateLimit` is not defined, rate-limiting is disabled for that route.

```
server.route([{
  method: 'POST',
  path: '/disabled_route',
  config: {
    handler: (request, reply) => {
      reply({ rate: request.plugins['hapi-rate-limiter'].rate });
    }
  }
}]);
```

## Headers
Rate-limiting information for each request is attached to the response header with the following keys:

`x-rate-limit-limit:` total number of requests allowed within the window

`x-rate-limit-remaining:` remaining number of requests allows within current window

`x-rate-limit-reset:` time when rate-limiter will reset (UTC seconds-since-epoch)
