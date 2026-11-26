const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

jest.mock('../../config/sockets', () => ({ emitToRoom: jest.fn() }));
jest.mock('../../config/multer', () => ({ promoteFile: jest.fn(), deleteFile: jest.fn() }));
jest.mock('../../config/config', () => ({
  db: {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    name: process.env.POSTGRES_DB,
    max: 5,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
  },
}));
jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());

// Opt in against a disposable database initialized by e2e/compose.yaml.
const integration = process.env.APPOINTMENT_TEST_DB === '1' ? describe : describe.skip;

integration('appointment booking concurrency in PostgreSQL', () => {
  let pool;
  let submitAppointment;
  let patientIds;
  let schedulerIds;
  let date;

  beforeAll(async () => {
    if (process.env.POSTGRES_DB !== 'mdsystem_e2e' || !process.env.POSTGRES_HOST) {
      throw new Error('Set the PostgreSQL connection variables for the disposable mdsystem_e2e database.');
    }
    pool = require('../../config/db');
    ({ submitAppointment } = require('./resolvers/patient/patient-resolver').Mutation);
    const result = await pool.query('SELECT current_database() AS name');
    expect(result.rows[0].name).toBe('mdsystem_e2e');
  });

  beforeEach(async () => {
    patientIds = [];
    schedulerIds = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    date = [tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate()]
      .map(part => String(part).padStart(2, '0')).join('-');

    for (let index = 0; index < 2; index += 1) {
      const fixtureKey = randomUUID();
      const { rows: [patient] } = await pool.query(`
        INSERT INTO "UserCredentials" (email, identity, credentials_status)
        VALUES ($1, 'Student', 'Active') RETURNING id
      `, [`appointment-${fixtureKey}@example.invalid`]);
      patientIds.push(patient.id);
      await pool.query(`INSERT INTO "UsersPersonal" (id, branch) VALUES ($1, 'Manila')`, [patient.id]);
      await pool.query(`INSERT INTO "Patients" (id, profile) VALUES ($1, 'Student')`, [patient.id]);

      const { rows: [scheduler] } = await pool.query(`
        INSERT INTO "slotScheduler" (label, location, "scheduleFlags", "morningAllowed", "afternoonAllowed")
        VALUES ($1, 'Arlegui', 127, 1, 1) RETURNING id
      `, [`Concurrency fixture ${fixtureKey}`]);
      schedulerIds.push(scheduler.id);
    }
  });

  afterEach(async () => {
    if (!pool || !patientIds) return;
    await pool.query('DELETE FROM "slotScheduler" WHERE id = ANY($1::int[])', [schedulerIds]);
    await pool.query('DELETE FROM "SystemAuditLog" WHERE "actorId" = ANY($1::int[])', [patientIds]);
    await pool.query('DELETE FROM "Patients" WHERE id = ANY($1::int[])', [patientIds]);
    await pool.query('DELETE FROM "UsersPersonal" WHERE id = ANY($1::int[])', [patientIds]);
    await pool.query('DELETE FROM "UserCredentials" WHERE id = ANY($1::int[])', [patientIds]);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  function book(patientId, schedulerId) {
    const res = { status: jest.fn() };
    return submitAppointment(null, { schedulerId, date, session: 'Morning', requirements: [] }, {
      user: { id: patientId }, res,
    }).catch(error => {
      expect(res.status).toHaveBeenLastCalledWith(400);
      throw error;
    });
  }

  async function race(lockSql, lockParams, waitingSql, bookings) {
    const blocker = await pool.connect();
    let results;
    try {
      await blocker.query('BEGIN');
      await blocker.query(lockSql, lockParams);
      results = Promise.allSettled(bookings.map(([patientId, schedulerId]) => book(patientId, schedulerId)));
      const deadline = Date.now() + 5_000;
      let waiting = 0;
      while (waiting < bookings.length && Date.now() < deadline) {
        const { rows: [activity] } = await pool.query(`
          SELECT count(*)::int AS waiting
          FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE $1
        `, [waitingSql]);
        waiting = activity.waiting;
        if (waiting < bookings.length) await delay(25);
      }
      expect(waiting).toBe(bookings.length);
    } finally {
      try {
        await blocker.query('ROLLBACK');
      } finally {
        blocker.release();
        if (results) await results;
      }
    }
    return results;
  }

  async function expectOneBooking(results, message) {
    const accepted = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter(result => result.status === 'rejected');
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.message).toBe(message);
    const winner = accepted[0].value;
    const { rows } = await pool.query(`
      SELECT ps.id, ps."patientId", ps.status, ps.session
      FROM "patientSlot" ps JOIN "ScheduleDateEntity" sd ON sd.id = ps."slotEntityId"
      WHERE sd."slotId" = ANY($1::int[])
    `, [schedulerIds]);
    expect(rows).toEqual([{ id: winner.id, patientId: winner.patientId, status: 'Pending', session: 'Morning' }]);
  }

  test.each(['existing', 'new'])('one patient gets the last slot when the date row is %s', async kind => {
    const [schedulerId] = schedulerIds;
    if (kind === 'existing') {
      await pool.query(`
        INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
        VALUES ($1, $2, 1, 1)
      `, [schedulerId, date]);
    }
    // For a new date, let both requests see the missing row before either can insert.
    const results = await race(
      `LOCK TABLE "ScheduleDateEntity" IN ${kind === 'new' ? 'SHARE' : 'EXCLUSIVE'} MODE`,
      [],
      kind === 'new' ? 'INSERT INTO "ScheduleDateEntity"%' : 'SELECT * FROM "ScheduleDateEntity"%',
      patientIds.map(id => [id, schedulerId]),
    );
    await expectOneBooking(results, 'Morning session already full for the selected date');
    const { rows } = await pool.query('SELECT id FROM "ScheduleDateEntity" WHERE "slotId" = $1', [schedulerId]);
    expect(rows).toHaveLength(1);
  }, 15_000);

  test('the same patient cannot hold two active bookings across schedulers', async () => {
    const [patientId] = patientIds;
    const lock = 'SELECT id FROM "Patients" WHERE id = $1 FOR NO KEY UPDATE';
    const results = await race(lock, [patientId], `${lock}%`, schedulerIds.map(id => [patientId, id]));
    await expectOneBooking(results, 'User already has an active appointment');
  }, 15_000);
});
