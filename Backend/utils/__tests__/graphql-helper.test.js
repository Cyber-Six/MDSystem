const { throwGraphQLError, GraphQLError } = require('../graphql-helper');

describe('GraphQL error builder', () => {
  test('sets the default HTTP response status and creates a typed error', () => {
    const res = { status: jest.fn() };
    const builder = throwGraphQLError(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(() => builder.throw()).toThrow(GraphQLError);
    try {
      builder.throw();
    } catch (error) {
      expect(error.message).toBe('Bad Request');
      expect(error).toBeInstanceOf(GraphQLError);
    }
  });

  test.each([
    [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'],
    [409, 'CONFLICT'], [500, 'INTERNAL_SERVER_ERROR'], [418, 'INTERNAL_SERVER_ERROR'],
  ])('maps status %i through the response builder', (status) => {
    const res = { status: jest.fn() };
    const builder = throwGraphQLError(res).status(status).message('Request failed');
    expect(res.status).toHaveBeenLastCalledWith(status);
    try {
      builder.throw();
    } catch (error) {
      expect(error.message).toBe('Request failed');
      expect(error).toBeInstanceOf(GraphQLError);
    }
  });
});
