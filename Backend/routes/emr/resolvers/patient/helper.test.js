jest.mock('../../../../config/query', () => ({}));
const { assertActiveUpdateTicket } = require('./helper');
const res = { status: jest.fn().mockReturnThis() };
test.each(["InProgress","Revision"])('accepts actionable %s tickets with matching or combined scope', status => {
  expect(() => assertActiveUpdateTicket({ status, scope: 'Medical' }, res)).not.toThrow();
  expect(() => assertActiveUpdateTicket({ status, scope: 'Both' }, res, 'Dental')).not.toThrow();
  expect(() => assertActiveUpdateTicket({ status, scope: 'Medical' }, res, 'Medical')).not.toThrow();
  expect(() => assertActiveUpdateTicket({ status, scope: 'Medical' }, res, 'Dental')).toThrow('Dental scope is required');
  expect(res.status).toHaveBeenCalledWith(403);
});
test.each(["Pending","RevisionSubmitted"])('rejects processing ticket %s', status => {
  expect(() => assertActiveUpdateTicket({ status }, res)).toThrow('still being processed');
  expect(res.status).toHaveBeenCalledWith(400);
});
test('rejects expired and inactive tickets', () => {
  expect(() => assertActiveUpdateTicket({ status: 'Expired' }, res)).toThrow('has expired');
  expect(() => assertActiveUpdateTicket({ status: 'Completed' }, res)).toThrow('No active update ticket');
});
test('rejects missing tickets with a 404', () => {
  expect(() => assertActiveUpdateTicket(null, res)).toThrow('No update ticket');
  expect(res.status).toHaveBeenCalledWith(404);
});
