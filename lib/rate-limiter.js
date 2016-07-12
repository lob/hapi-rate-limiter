'use strict';

exports.register = (defaultRate, routes) => {
  return routes.reduce((rateTable, route) => {
    if (!(route.method === 'get' || route.method === 'post' || route.method === 'delete')) {
      return rateTable;
    }

    const rate = defaultRate;
    const routeSettings = route.settings.plugins ? route.settings.plugins.rateLimit : null;

    if (routeSettings) {
      if (routeSettings.enabled === false) {
        return rateTable;
      }

      rate.limit = routeSettings.limit;
      rate.window = routeSettings.window;
    }

    rateTable[`${route.method}:${route.path}`] = rate;
    return rateTable;
  }, {});
};
