const { endpointContract } = require('../../test-support/graphql-endpoint.cjs');

endpointContract(__dirname, {
  "resolvers": {
    "resolvers/patient/patient-resolver.js": "patient",
    "resolvers/medical/medical-resolver.js": "medical"
  },
  "endpoints": [
    {
      "init": "initPatientAppointmentGraphQL",
      "route": "/appointment/patient",
      "role": "patient",
      "resolver": "patient",
      "rejectEmpty": true,
      "credentials": true
    },
    {
      "init": "initMedicalAppointmentGraphQL",
      "route": "/appointment/medical",
      "role": "medical",
      "resolver": "medical",
      "rejectEmpty": true,
      "nullUser": true
    }
  ]
});
