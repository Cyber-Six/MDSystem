'use strict';

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const VERIFY_COLUMN_COMMAND = 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = \'employee_profile\' AND column_name = \'employmentCategoryOther\')"';

function runCompose(args, input) {
  const result = spawnSync('docker', ['compose', ...args], {
    input,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`docker compose ${args.slice(0, 4).join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return (result.stdout || '').trim();
}

function applyEmployeeCategoryMigration(migrationPath, compose = runCompose) {
  if (!migrationPath || !fs.existsSync(migrationPath)) {
    throw new Error(`Employee category migration SQL file is missing: ${migrationPath || '(path not provided)'}`);
  }
  const sql = fs.readFileSync(migrationPath, 'utf8');
  if (!sql.trim()) throw new Error(`Employee category migration SQL file is empty: ${migrationPath}`);

  compose([
    'exec', '-T', 'postgres', 'sh', '-ec',
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1',
  ], sql);

  const exists = compose(['exec', '-T', 'postgres', 'sh', '-ec', VERIFY_COLUMN_COMMAND]);
  if (exists !== 't') {
    throw new Error('Migration ran but employee_profile.employmentCategoryOther is still missing.');
  }
  return true;
}

if (require.main === module) {
  try {
    applyEmployeeCategoryMigration(process.argv[2]);
    console.log('Verified employee_profile.employmentCategoryOther exists.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { applyEmployeeCategoryMigration, VERIFY_COLUMN_COMMAND };
