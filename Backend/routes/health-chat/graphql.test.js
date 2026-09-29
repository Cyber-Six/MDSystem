const { endpointContract } = require('../../test-support/graphql-endpoint.cjs');

endpointContract(__dirname, {
  "resolvers": {
    "resolvers/patient/patient-resolver.js": "patient",
    "resolvers/medical/medical-resolver.js": "medical"
  },
  "endpoints": [
    {
      "init": "initPatientHealthChatGraphQL",
      "route": "/healthchat/patient",
      "role": "patient",
      "resolver": "patient",
      "rejectEmpty": true,
      "credentials": true
    },
    {
      "init": "initMedicalHealthChatGraphQL",
      "route": "/healthchat/medical",
      "role": "medical",
      "resolver": "medical",
      "rejectEmpty": true,
      "credentials": true
    }
  ]
});
