const { buildSchema } = require('graphql');

const EMRschema = buildSchema(`
  type User {
    id: Int
    name: String
    email: String
  }

  type Query {
    getUser(id: ID!): User
    listUsers: [User]
  }
`);

module.exports = EMRschema;
