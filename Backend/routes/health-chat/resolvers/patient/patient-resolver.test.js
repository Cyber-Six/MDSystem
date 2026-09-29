jest.mock('../wrapper/wrapper', () => ({
  Query: Object.fromEntries(['_getMyTickets', '_getMyTicket', '_getTicketMessages'].map(key => [key, jest.fn()])),
  Mutation: Object.fromEntries(['_createTicket', '_sendPatientMessage', '_closeMyTicket', '_extendSession'].map(key => [key, jest.fn()])),
}));
const wrapper = require('../wrapper/wrapper');
const resolver = require('./patient-resolver');
test.each([
  ['Query', 'getMyTickets', '_getMyTickets'], ['Query', 'getMyTicket', '_getMyTicket'], ['Query', 'getTicketMessages', '_getTicketMessages'],
  ['Mutation', 'createTicket', '_createTicket'], ['Mutation', 'sendPatientMessage', '_sendPatientMessage'],
  ['Mutation', 'closeMyTicket', '_closeMyTicket'], ['Mutation', 'extendSession', '_extendSession'],
])('forwards %s.%s to its authorized wrapper', async (group, name, target) => {
  const parent = {}, args = { id: 8 }, context = { user: { id: 12 } };
  wrapper[group][target].mockResolvedValueOnce({ id: 8 }).mockRejectedValueOnce(new Error('denied'));
  await expect(resolver[group][name](parent, args, context)).resolves.toEqual({ id: 8 });
  expect(wrapper[group][target]).toHaveBeenCalledWith(parent, args, context);
  await expect(resolver[group][name](parent, args, context)).rejects.toThrow('denied');
});
