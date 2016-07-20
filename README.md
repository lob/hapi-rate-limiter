# hapi-rate-limit
A [Hapi](http://hapijs.com/) plugin that enables rate-limiting for GET, POST, and DELETE requests. This plugin can be configured with custom
rates on a route-by-route basis.

## Register the plugin
```
const Hapi = require('hapi');

const server = new Hapi.Server();

server.register([
  register: require('hapi-rate-limit'),
  options: {
    defaultRate: {
      limit: 10,
      window: 60
    },
    redisClient: myThenRedisClient,
    overLimitError: ErrConstructor
  }
], (err) => {

});
```

#### Options
All options `(defaultRate, redisClient, overLimitError)` are required for the plugin to work properly.
##### `defaultRate`
```
{
  limit: # of max requests allows within window
  window: # of seconds before count resets
}
```

##### `redisClient`
A `then-redis` client that is already connected

##### `overLimitError`
If a request count goes over the max limit, this constructor is used to instantiate an error object and return it in the response

## Managing Routes
Settings for individual routes can be set while registering a route.

#### Custom Rate
A custom `limit` and `window` can be registered for each route.

```
server.route([{
  method: 'POST',
  path: '/custom_rate_route',
  config: {
    plugins: {
      rateLimit: {
        limit: 20,
        window: 30
      }
    },
    handler: (request, reply) => {
      reply({ rate: request.plugins['hapi-rate-limit'].rate });
    }
  }
}]);
```

#### Disable Rate-Limiting for route
Rate-limiting can be disabled for a particular route by setting `enabled: false` to the plugin settings while registering a route. Plugin for route is enabled by default.

```
server.route([{
  method: 'POST',
  path: '/disabled_route',
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
}]);
```

## Headers
Rate-limiting information for each request is attached to the response header with the following keys:

`x-rate-limit-limit:` total number of requests allowed within the window

`x-rate-limit-remaining:` remaining number of requests allows within current window

`x-rate-limit-reset:` time when rate-limiter will reset (UTC seconds-since-epoch)
