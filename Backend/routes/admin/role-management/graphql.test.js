const { endpointContract } = require('../../../test-support/graphql-endpoint.cjs');

endpointContract(__dirname, {
  "resolvers": {
    "resolvers/admin/admin-resolver.js": "admin"
  },
  "endpoints": [
    {
      "init": "initRoleManagementGraphQL",
      "route": "/rolemanagement/admin",
      "role": "medical",
      "resolver": "admin",
      "rejectEmpty": true,
      "nullUser": true,
      "productionGraphiql": true,
      "limiter": [
        "staffAuthentication",
        "admin"
      ]
    }
  ]
});
