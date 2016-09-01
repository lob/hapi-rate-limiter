# hapi-rate-limiter
A [Hapi](http://hapijs.com/) plugin that enables rate-limiting for GET, POST, and DELETE requests. This plugin can be configured with custom
rates on a route-by-route basis.

## Register the plugin
```
const Hapi = require('hapi');

const server = new Hapi.Server();

const defaultRate = {
  limit: 10,
  window: 60
};

server.register([
  register: require('hapi-rate-limiter'),
  options: {
    defaultRate: (request) => defaultRate,
    redisClient: myThenRedisClient,
    overLimitError: ErrConstructor
  }
], (err) => {

});
```

#### Options
All options `(defaultRate, rateLimitKey, redisClient, overLimitError)` are required for the plugin to work properly.

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

##### `rateLimitKey`
A function that returns a key for an given request. This can be any differentiating value in each request, such as an API Key, IP Address, etc

##### `redisClient`
A `then-redis` client that is already connected

##### `overLimitError`
If a request count goes over the max limit, this constructor is used to instantiate an error object and return it in the response

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
