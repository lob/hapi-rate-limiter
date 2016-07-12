'use strict';

const RateLimiter = require('../lib/rate-limiter');

const baseRoute = {
  path: '/testPost',
  settings: {}
};

const defaultRate = { limit: 1, window: 60 };

describe('rate limiter', () => {

  describe('register', () => {

    it('only limits GET, POST, and DELETE routes', () => {
      const postRoute = Object.assign({ method: 'post' }, baseRoute);
      const putRoute = Object.assign({ method: 'put' }, baseRoute);

      const rateTable = RateLimiter.register(defaultRate, [postRoute, putRoute]);

      expect(Object.keys(rateTable).length).to.eql(1);
    });

    it('sets custom rate if given else default', () => {
      const customRate = { limit: 1, window: 1 };
      const defaultRoute = Object.assign({ method: 'post' }, baseRoute);
      const customRoute = Object.assign({ method: 'get' }, baseRoute);

      customRoute.settings = { plugins: { rateLimit: customRate } };

      const rateTable = RateLimiter.register(defaultRate, [defaultRoute, customRoute]);

      expect(rateTable[`${defaultRoute.method}:${defaultRoute.path}`]).to.eql(defaultRate);
      expect(rateTable[`${customRoute.method}:${customRoute.path}`]).to.eql(customRate);
    });

    it('ignores rate-limit disabled routes', () => {
      const okRoute = Object.assign({ method: 'post' }, baseRoute);
      const disabledRoute = Object.assign({ method: 'get' }, baseRoute);

      disabledRoute.settings = { plugins: { rateLimit: { enabled: false } } };

      const rateTable = RateLimiter.register(defaultRate, [disabledRoute, okRoute]);

      expect(Object.keys(rateTable).length).to.eql(1);
    });

  });

});
