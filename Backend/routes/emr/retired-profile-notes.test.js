const fs = require('fs');
const path = require('path');
const { graphql } = require('graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const compatibility = require('./retired-profile-notes');

test('installed mobile documents still accept notes inputs and read null without storage', async () => {
  const createHistory = jest.fn((_, { input }) => ({ id: 12, conditions: input.conditions }));
  const createImmunization = jest.fn((_, { input }) => ({ id: 12, immunizations: input.immunizations }));
  const schema = makeExecutableSchema({
    typeDefs: fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8'),
    resolvers: { ...compatibility,
      Query: {
        getMedicalHistory: () => ({ id: 12, conditions: [], notes: 'retired stored value' }),
        getImmunizationProfile: () => ({ id: 12, immunizations: [] }),
      },
      Mutation: { createMedicalHistory: createHistory, createImmunizationProfile: createImmunization },
    },
  });
  const mutation = await graphql({ schema, source: `mutation {
    createMedicalHistory(input: { conditions: [], notes: "legacy input" }) { id notes }
    createImmunizationProfile(input: { immunizations: [], notes: null }) { id notes }
  }` });
  expect(mutation.errors).toBeUndefined();
  expect(mutation.data.createMedicalHistory).toEqual({ id: '12', notes: null });
  expect(mutation.data.createImmunizationProfile).toEqual({ id: '12', notes: null });
  const read = await graphql({ schema, source: '{ getMedicalHistory { notes } getImmunizationProfile { notes } }' });
  expect(read.errors).toBeUndefined();
  expect(read.data.getMedicalHistory.notes).toBeNull();
  expect(read.data.getImmunizationProfile.notes).toBeNull();
  expect(schema.getType('MedicationProfile').getFields().notes.deprecationReason).toBeUndefined();
  expect(schema.getType('UpdateTicket').getFields().notes.deprecationReason).toBeUndefined();
});
