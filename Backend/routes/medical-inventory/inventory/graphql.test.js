const { endpointContract } = require('../../../test-support/graphql-endpoint.cjs');

endpointContract(__dirname, {
  "resolvers": {
    "resolvers/medical/medical-resolver.js": "medical"
  },
  "endpoints": [
    {
      "init": "initMedicalInventoryGraphQL",
      "route": "/medical-inventory/medical",
      "role": "medical",
      "resolver": "medical"
    }
  ]
});
