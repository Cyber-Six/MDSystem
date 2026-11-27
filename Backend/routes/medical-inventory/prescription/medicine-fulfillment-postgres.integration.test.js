const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

jest.mock('../../../config/sockets', () => ({ emitToRole: jest.fn(), notifyUser: jest.fn() }));
jest.mock('../../../services/email/emailservice', () => ({ enqueueNotificationEmail: jest.fn() }));
jest.mock('../../../utils/logger', () => require('../../../test-support/fixtures.cjs').loggerMock());
jest.mock('../../../config/config', () => ({
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

// Use the disposable database and accounts initialized by e2e/compose.yaml.
const integration = process.env.MEDICINE_TEST_DB === '1' ? describe : describe.skip;

integration('medicine fulfillment concurrency in PostgreSQL', () => {
  let pool;
  let issuePrescription;
  let staffId;
  let patientIds;
  let marker;
  let itemId;
  let batchIds;
  let requests;

  beforeAll(async () => {
    if (process.env.POSTGRES_DB !== 'mdsystem_e2e' || !process.env.POSTGRES_HOST) {
      throw new Error('Set the PostgreSQL connection variables for the disposable mdsystem_e2e database.');
    }
    pool = require('../../../config/db');
    ({ issuePrescription } = require('./resolvers/medical/medical-resolver').Mutation);
    const emails = [process.env.E2E_STAFF_EMAIL, process.env.E2E_PATIENT_EMAIL, process.env.E2E_ALT_PATIENT_EMAIL];
    const { rows } = await pool.query('SELECT id, email FROM "UserCredentials" WHERE email = ANY($1::text[])', [emails]);
    expect(rows).toHaveLength(3);
    const byEmail = new Map(rows.map(({ id, email }) => [email, id]));
    [staffId, ...patientIds] = emails.map(email => byEmail.get(email));
  });

  beforeEach(async () => {
    marker = `medicine-race-${randomUUID()}`;
    itemId = undefined;
    requests = [];
    const { rows: [item] } = await pool.query(`
      INSERT INTO "MedicalItems" (item_code, item_name, category)
      VALUES ($1, 'Concurrency Test Medicine', 'Medicine') RETURNING id
    `, [marker]);
    itemId = item.id;
    const { rows: batches } = await pool.query(`
      INSERT INTO "MedicineBatch" ("medicalItemId", "batchNumber", "dosageUnit", "dosageValue", "expiryDate", location)
      SELECT $1, 'race-' || batch, 'mg', 100, CURRENT_DATE + 30, 'Arlegui'
      FROM generate_series(1, 2) AS batch RETURNING id
    `, [itemId]);
    batchIds = batches.map(batch => batch.id);
    await pool.query(`
      INSERT INTO "MedicineEntity" ("batchId")
      SELECT batch_id FROM unnest($1::int[]) AS batch_id CROSS JOIN generate_series(1, 3)
    `, [batchIds]);

    for (const patientId of patientIds) {
      const { rows: [request] } = await pool.query(`
        INSERT INTO "MedicineRequestLog" ("patientId", status, location, purpose, approved_by)
        VALUES ($1, 'Approved', 'Arlegui', $2, $3) RETURNING id, "patientId"
      `, [patientId, marker, staffId]);
      requests.push(request);
      await pool.query(`
        INSERT INTO "MedicineRequestEntity" ("requestId", "medicineId", quantity) VALUES ($1, $2, 2)
      `, [request.id, itemId]);
    }
  });

  afterEach(async () => {
    if (!pool || !marker) return;
    await pool.query(`DELETE FROM "SystemAuditLog" WHERE action = 'ISSUE_LINKED_PRESCRIPTION'
      AND details->>'requestId' = ANY($1::text[])`, [requests.map(request => String(request.id))]);
    await pool.query('DELETE FROM "MedicineRequestLog" WHERE purpose = $1', [marker]);
    await pool.query('DELETE FROM "MedicalItems" WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM "MedicineTransactionLog" WHERE notes = $1', [marker]);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  function dispense(request, batchId) {
    const res = { status: jest.fn() };
    return issuePrescription(null, {
      input: { requestId: request.id, patientId: request.patientId, items: [{ batchId, quantity: 2 }], notes: marker },
    }, { user: { id: staffId }, res }).catch(error => {
      expect(res.status).toHaveBeenLastCalledWith(400);
      throw error;
    });
  }

  async function race(lock, params, waitingQuery, entries) {
    const blocker = await pool.connect();
    let results;
    try {
      await blocker.query('BEGIN');
      await blocker.query(lock, params);
      results = Promise.allSettled(entries.map(([request, batchId]) => dispense(request, batchId)));
      const deadline = Date.now() + 5_000;
      let waiting = 0;
      while (waiting < entries.length && Date.now() < deadline) {
        const { rows: [{ count }] } = await pool.query(`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE $1
        `, [waitingQuery]);
        waiting = count;
        if (waiting < entries.length) await delay(25);
      }
      expect(waiting).toBe(entries.length);
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

  async function expectOneDispense(results, rejectedMessage) {
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter(result => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.message).toMatch(rejectedMessage);

    const { rows: transactions } = await pool.query(`
      SELECT tx.id, tx."patientId", tx.quantity, count(me.id)::int AS assigned
      FROM "MedicineTransactionLog" tx LEFT JOIN "MedicineEntity" me ON me."transactionId" = tx.id
      WHERE tx.notes = $1 GROUP BY tx.id
    `, [marker]);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ quantity: 2, assigned: 2 });
    const { rows: stock } = await pool.query(`
      SELECT "batchId", count(*) FILTER (WHERE "transactionId" IS NULL)::int AS available
      FROM "MedicineEntity" WHERE "batchId" = ANY($1::int[]) GROUP BY "batchId" ORDER BY available
    `, [batchIds]);
    expect(stock.map(batch => batch.available)).toEqual([1, 3]);
    const { rows: statuses } = await pool.query(`
      SELECT "patientId", status FROM "MedicineRequestLog" WHERE purpose = $1 ORDER BY id
    `, [marker]);
    expect(statuses).toEqual(requests.map(({ patientId }) => ({
      patientId, status: patientId === transactions[0].patientId ? 'Completed' : 'Approved',
    })));
  }

  test('competing approved requests cannot dispense four units from an inventory of three', async () => {
    const [batchId] = batchIds;
    const results = await race(
      'SELECT id FROM "MedicineEntity" WHERE "batchId" = $1 ORDER BY id FOR UPDATE',
      [batchId], '%WITH selected AS%', requests.map(request => [request, batchId]),
    );
    await expectOneDispense(results, /Insufficient available units for batch/);
  }, 15_000);

  test('concurrent fulfillment of the same request cannot dispense from two batches', async () => {
    const [request] = requests;
    const results = await race(
      'SELECT id FROM "MedicineRequestLog" WHERE id = $1 FOR UPDATE',
      [request.id], '%"MedicineRequestLog"%', batchIds.map(batchId => [request, batchId]),
    );
    await expectOneDispense(results, /Only approved medicine requests can be dispensed/);
  }, 15_000);
});
