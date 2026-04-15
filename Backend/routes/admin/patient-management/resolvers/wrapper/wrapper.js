const adminResolver = require('../admin/admin-resolver');

const resolverWrapper = {
    Query: {
        ...adminResolver.Query,
    },
    Mutation: {
        ...adminResolver.Mutation,
    },
    Patient: {
        ...adminResolver.Patient,
    },
};

module.exports = resolverWrapper;