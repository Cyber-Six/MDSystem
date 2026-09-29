const { endpointContract } = require('../../test-support/graphql-endpoint.cjs');

endpointContract(__dirname, {
  "resolvers": {
    "resolvers/patient/patient-resolver.js": "patient",
    "resolvers/medical/medical-resolver.js": "medical"
  },
  "endpoints": [
    {
      "init": "initPatientProfileGraphQL",
      "route": "/profile/patient",
      "role": "patient",
      "resolver": "patient",
      "rejectEmpty": true
    },
    {
      "init": "initMedicalProfileGraphQL",
      "route": "/profile/medical",
      "role": "medical",
      "resolver": "medical",
      "rejectEmpty": true,
      "nullUser": true
    }
  ]
});
