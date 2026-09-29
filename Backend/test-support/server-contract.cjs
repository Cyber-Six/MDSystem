const path = require('path');
const { loggerMock, withEnvironment } = require('./fixtures.cjs');
const root = path.resolve(__dirname, '..');
const graphQL = {
  'emr': ['initPatientEMRGraphQL', 'initMedicalEMRGraphQL'],
  'staff/emr': ['initStaffEMRGraphQL'], 'profile': ['initPatientProfileGraphQL', 'initMedicalProfileGraphQL'],
  'appointment': ['initPatientAppointmentGraphQL', 'initMedicalAppointmentGraphQL'],
  'consultation/consult': ['initMedicalConsultationGraphQL'],
  'medical-inventory/inventory': ['initMedicalInventoryGraphQL'],
  'medical-inventory/medicine-request': ['initPatientMedicineRequestGraphQL', 'initMedicalMedicineRequestGraphQL'],
  'medical-inventory/prescription': ['initPrescriptionGraphQL'],
  'health-chat': ['initPatientHealthChatGraphQL', 'initMedicalHealthChatGraphQL'],
  'admin/role-management': ['initRoleManagementGraphQL'],
  'dashboard': ['initDashboardGraphQL', 'initPatientDashboardGraphQL'],
};
const routeModules = [
  'auth/user/register', 'auth/user/login', 'auth/user/user-password', 'auth/email/emailauth',
  'auth/email/emailpassword-reset', 'auth/jwt/refresh', 'auth/jwt/logout', 'auth/push-token', 'auth/oauth/google',
  'info/compliance/consent', 'media/media', 'info/announcement/announcement',
  'documents/document/document-patient', 'documents/document/document-staff',
  'settings/settings', 'settings/totp', 'settings/password', 'analytics/analytics', 'staff/profile', 'dashboard/rest-endpoint',
];

function serverContract(filename, { portal, defaultPort, portVariable, requiredRoutes, initializers }) {
  describe(`${portal} server lifecycle`, () => {
    let restore, app, server, io, redis, sockets, hooks, exit, jwtGuard, graphqlInitializers, cors;
    beforeEach(() => {
      jest.resetModules();
      restore = withEnvironment({ CORS_ALLOWED_ORIGINS: undefined, CHATBOT_URL: undefined, [portVariable]: undefined, HOST: '127.0.0.1' });
      server = { close: jest.fn(callback => callback()) };
      io = { close: jest.fn() };
      app = { use: jest.fn(), get: jest.fn(), set: jest.fn(), listen: jest.fn((_port, _host, callback) => { callback(); return server; }) };
      const express = Object.assign(jest.fn(() => app), { json: jest.fn(() => 'json'), static: jest.fn(directory => ({ static: directory })) });
      cors = jest.fn(options => ({ cors: options }));
      redis = { initRedis: jest.fn().mockResolvedValue() };
      sockets = { initSocket: jest.fn().mockResolvedValue(), getIO: jest.fn(() => io) };
      jwtGuard = jest.fn((_req, _res, next) => next());
      jest.doMock('express', () => express);
      jest.doMock('cors', () => cors);
      jest.doMock('compression', () => () => 'compression');
      jest.doMock('helmet', () => () => 'helmet');
      jest.doMock('dotenv', () => ({ config: jest.fn() }));
      jest.doMock(path.join(root, 'config/db.js'), () => ({}));
      jest.doMock(path.join(root, 'config/redis.js'), () => redis);
      jest.doMock(path.join(root, 'config/sockets/index.js'), () => sockets);
      jest.doMock(path.join(root, 'utils/logger.js'), () => loggerMock());
      jest.doMock(path.join(root, 'config/middleware/chatbotProxy.js'), () => ({ chatbotProxy: 'chatbot' }));
      jest.doMock(path.join(root, 'config/middleware/jwtProtect.js'), () => ({ jwtProtect: jest.fn(() => jwtGuard) }));
      for (const module of ['health-chat-events', 'notification-events', 'acknowledgement-events']) {
        jest.doMock(path.join(root, `config/sockets/${module}.js`), () => ({}));
      }
      for (const module of routeModules) jest.doMock(path.join(root, `routes/${module}.js`), () => ({ routeModule: module }));
      graphqlInitializers = {};
      for (const [module, names] of Object.entries(graphQL)) {
        const exports = Object.fromEntries(names.map(name => [name, jest.fn()]));
        Object.assign(graphqlInitializers, exports);
        jest.doMock(path.join(root, `routes/${module}/graphql.js`), () => exports);
      }
      hooks = {};
      jest.spyOn(process, 'on').mockImplementation((signal, callback) => { hooks[signal] = callback; return process; });
      exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });
    afterEach(() => { jest.restoreAllMocks(); restore(); });
    async function load() {
      require(path.join(root, filename));
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
    test.each([false, true])('starts guarded routes and handles requests (configured=%s)', async configured => {
      if (configured) Object.assign(process.env, { CORS_ALLOWED_ORIGINS: 'https://one.invalid,https://two.invalid', CHATBOT_URL: 'http://chatbot.invalid', [portVariable]: '4000' });
      await load();
      expect(cors).toHaveBeenCalledWith({ origin: configured ? ['https://one.invalid', 'https://two.invalid'] : false, credentials: true });
      expect(app.listen).toHaveBeenCalledWith(configured ? '4000' : defaultPort, '127.0.0.1', expect.any(Function));
      expect(redis.initRedis).toHaveBeenCalledTimes(1);
      expect(sockets.initSocket).toHaveBeenCalledWith(server);
      expect(app.set).toHaveBeenCalledWith('trust proxy', true);
      for (const route of requiredRoutes) expect(app.use.mock.calls.map(call => call[0])).toContain(route);
      for (const name of initializers) expect(graphqlInitializers[name]).toHaveBeenCalledWith(app);
      const functions = app.use.mock.calls.map(call => call[0]).filter(value => typeof value === 'function');
      const normalize = functions.find(fn => fn.length === 3), errors = functions.find(fn => fn.length === 4);
      const next = jest.fn(), request = {};
      normalize(request, {}, next);
      expect(request.body).toEqual({});
      request.body = { value: 1 };
      normalize(request, {}, next);
      expect(request.body).toEqual({ value: 1 });
      const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), sendFile: jest.fn() };
      errors(Object.assign(new SyntaxError('bad JSON'), { status: 400, body: '{bad' }), {}, response, next);
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_JSON' }));
      for (const error of [new Error('other'), Object.assign(new SyntaxError('other'), { status: 500 }), Object.assign(new SyntaxError('other'), { status: 400 })]) errors(error, {}, response, next);
      expect(next).toHaveBeenCalledTimes(5);
      const fallback = app.get.mock.calls.find(([route]) => route === '*path')[1];
      fallback({}, response);
      expect(response.sendFile).toHaveBeenCalledWith(path.resolve(root, `../mds-${portal}/dist/index.html`));
      if (portal === 'staff') {
        const guard = app.use.mock.calls.find(([route]) => route === '/econsultation/chat')[1];
        guard({ path: '/staff/message' }, response, next);
        expect(jwtGuard).toHaveBeenCalledTimes(1);
        guard({ path: '/health' }, response, next);
        expect(jwtGuard).toHaveBeenCalledTimes(1);
      }
      hooks.SIGTERM();
      expect(io.close).toHaveBeenCalledTimes(1);
      sockets.getIO.mockReturnValue(null);
      hooks.SIGINT();
      expect(server.close).toHaveBeenCalledTimes(2);
      expect(exit).toHaveBeenCalledWith(0);
    });
    test('exits on startup failure without listening', async () => {
      redis.initRedis.mockRejectedValue(new Error('redis offline'));
      await load();
      expect(app.listen).not.toHaveBeenCalled();
      expect(exit).toHaveBeenCalledWith(1);
      expect(hooks).toEqual({});
    });
  });
}
module.exports = { serverContract };
