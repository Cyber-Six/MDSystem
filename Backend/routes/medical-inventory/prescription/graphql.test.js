const { endpointContract } = require('../../../test-support/graphql-endpoint.cjs');

endpointContract(__dirname, {
  "resolvers": {
    "resolvers/patient/patient-resolver.js": "patient",
    "resolvers/medical/medical-resolver.js": "medical"
  },
  "endpoints": [
    {
      "init": "initPrescriptionGraphQL",
      "route": "/medical-inventory/prescription/medical",
      "role": "medical",
      "resolver": "medical"
    },
    {
      "init": "initPrescriptionGraphQL",
      "route": "/medical-inventory/prescription/patient",
      "role": "patient",
      "resolver": "patient",
      "credentials": true
    }
  ]
});
