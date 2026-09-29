const { endpointContract } = require('../../../test-support/graphql-endpoint.cjs');

endpointContract(__dirname, {
  "resolvers": {
    "resolvers/patient/patient-resolver.js": "patient",
    "resolvers/medical/medical-resolver.js": "medical"
  },
  "endpoints": [
    {
      "init": "initPatientMedicineRequestGraphQL",
      "route": "/medical-inventory/medicine-request/patient",
      "role": "patient",
      "resolver": "patient",
      "credentials": true
    },
    {
      "init": "initMedicalMedicineRequestGraphQL",
      "route": "/medical-inventory/medicine-request/medical",
      "role": "medical",
      "resolver": "medical"
    }
  ]
});
