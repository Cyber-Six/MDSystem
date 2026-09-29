const { endpointContract } = require('../../../test-support/graphql-endpoint.cjs');

endpointContract(__dirname, {
  "resolvers": {
    "resolvers/medical/medical-resolver.js": "medical"
  },
  "endpoints": [
    {
      "init": "initMedicalConsultationGraphQL",
      "route": "/consultation",
      "role": "medical",
      "resolver": "medical",
      "rejectEmpty": true,
      "nullUser": true
    }
  ]
});
