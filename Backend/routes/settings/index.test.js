jest.mock('./settings', () => ({ router: 'settings-router' }));
test('exports the settings router unchanged', () => {
  expect(require('./index')).toBe(require('./settings'));
});
