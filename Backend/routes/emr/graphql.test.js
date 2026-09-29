const { endpointContract } = require('../../test-support/graphql-endpoint.cjs');

endpointContract(__dirname, {
  "resolvers": {
    "resolvers/patient/patient-resolver.js": "patient",
    "resolvers/medical/medical-resolver.js": "medical"
  },
  "userProfile": true,
  "endpoints": [
    {
      "init": "initPatientEMRGraphQL",
      "route": "/emr/patient",
      "role": "patient",
      "resolver": "patient",
      "rejectEmpty": true
    },
    {
      "init": "initMedicalEMRGraphQL",
      "route": "/emr/medical",
      "role": "medical",
      "resolver": "medical",
      "rejectEmpty": true,
      "nullUser": true
    }
  ]
});
