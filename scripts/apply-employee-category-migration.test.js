'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { applyEmployeeCategoryMigration, VERIFY_COLUMN_COMMAND } = require('./apply-employee-category-migration');

test('applies the committed SQL and verifies the Employee category column', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'employee-category-migration-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const migrationPath = path.join(dir, 'migration.psql');
  const sql = 'ALTER TABLE "employee_profile" ADD COLUMN IF NOT EXISTS "employmentCategoryOther" text;';
  fs.writeFileSync(migrationPath, sql);
  const calls = [];

  assert.equal(applyEmployeeCategoryMigration(migrationPath, (args, input) => {
    calls.push({ args, input });
    return calls.length === 1 ? '' : 't';
  }), true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].args.slice(0, 3), ['exec', '-T', 'postgres']);
  assert.match(calls[0].args.at(-1), /ON_ERROR_STOP=1/);
  assert.equal(calls[0].input, sql);
  assert.deepEqual(calls[1].args.slice(0, 3), ['exec', '-T', 'postgres']);
  assert.match(VERIFY_COLUMN_COMMAND, /employmentCategoryOther/);
});

test('fails clearly when the schema still lacks the Employee category column', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'employee-category-migration-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const migrationPath = path.join(dir, 'migration.psql');
  fs.writeFileSync(migrationPath, 'ALTER TABLE employee_profile ADD COLUMN employmentCategoryOther text;');
  assert.throws(() => applyEmployeeCategoryMigration(migrationPath, (_args, _input) => 'f'), /still missing/);
});

test('requires a readable migration file', () => {
  assert.throws(() => applyEmployeeCategoryMigration(''), /file is missing/);
});

test('runs the additive migration after schema initialization for every Pi database setup path', () => {
  const workflowPath = path.resolve(__dirname, '../.github/workflows/ci.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const blocks = [
    ['Reset test database and deploy the tested image', 'Manually restart the Pi use-case services', true],
    ['Apply additive employee category migration', 'manual-reset-database:', false],
    ['Reset database, rerun SQL, and start services', null, true],
  ];
  for (const [start, end, requiresSchemaInit] of blocks) {
    const startAt = workflow.indexOf(start);
    const endAt = end ? workflow.indexOf(end, startAt + start.length) : workflow.length;
    assert.notEqual(startAt, -1, `CI workflow step not found: ${start}`);
    assert.notEqual(endAt, -1, `CI workflow end marker not found: ${end}`);
    const block = workflow.slice(startAt, endAt);
    const schemaInitAt = block.indexOf('schema-init');
    const migrationAt = block.indexOf('apply-employee-category-migration.js');
    assert.ok(migrationAt >= 0, `${start} must apply and verify the Employee column`);
    if (requiresSchemaInit) {
      assert.ok(schemaInitAt >= 0, `${start} must initialize the database schema`);
      assert.ok(migrationAt > schemaInitAt, `${start} must apply and verify the Employee column after schema initialization`);
    }
  }
});

test('Compose applies the additive migration for both fresh and already initialized databases', () => {
  const yaml = require('js-yaml');
  const compose = yaml.load(fs.readFileSync(path.resolve(__dirname, '../compose.yaml'), 'utf8'));
  const setup = compose.services['schema-init'];
  assert.ok(setup.volumes.includes('./schemas/migrations/20261015_employee_category_other.psql:/schema/employee_category_other.psql:ro'));
  const command = setup.command[0];
  const initializedBranch = command.slice(command.indexOf('if [ -f /state/initialized ]'), command.indexOf('exit 0'));
  assert.match(initializedBranch, /ON_ERROR_STOP=1 -f \/schema\/employee_category_other\.psql/);
  const freshBranch = command.slice(command.indexOf('existing_tables='));
  assert.ok(freshBranch.indexOf('/schema/employee_category_other.psql') > freshBranch.indexOf('/schema/post_build_setup.sql'));
  assert.ok(freshBranch.indexOf('/schema/employee_category_other.psql') < freshBranch.indexOf('touch /state/initialized'));
});
