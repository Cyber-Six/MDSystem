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

test('CI initializes databases through schema-init without a dedicated migration operation', () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/ci.yml'), 'utf8');
  assert.doesNotMatch(workflow, /migrate-employee-category|apply-schema-migrations|apply-employee-category-migration/);
  assert.equal((workflow.match(/--profile setup run --rm schema-init/g) || []).length, 2);
  const yaml = require('js-yaml');
  const parsed = yaml.load(workflow);
  assert.deepEqual(parsed.on.workflow_dispatch.inputs.operation.options, ['restart', 'reset-database']);
});

test('Compose applies the employee column through post-build setup on fresh initialization', () => {
  const yaml = require('js-yaml');
  const compose = yaml.load(fs.readFileSync(path.resolve(__dirname, '../compose.yaml'), 'utf8'));
  const setup = compose.services['schema-init'];
  assert.ok(setup.volumes.includes('${POST_BUILD_SETUP_SQL_PATH:-./schemas/post_build_setup.sql}:/schema/post_build_setup.sql:ro'));
  const command = setup.command[0];
  assert.doesNotMatch(command, /employee_category_other/);
  assert.ok(command.indexOf('-f /schema/post_build_setup.sql') > command.indexOf('-f /schema/schema.psql'));
  assert.ok(command.indexOf('-f /schema/post_build_setup.sql') < command.indexOf('touch /state/initialized'));
  const sql = fs.readFileSync(path.resolve(__dirname, '../schemas/post_build_setup.sql'), 'utf8');
  assert.match(sql, /ALTER TABLE "employee_profile"\s+ADD COLUMN IF NOT EXISTS "employmentCategoryOther" text;/);
});