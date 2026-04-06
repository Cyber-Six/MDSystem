#!/usr/bin/env node

/**
 * Environment Setup Script — mds-staff
 *
 * Automatically syncs .env from .env.example on every run.
 * Validates VITE_DEV_PORTAL is set to an allowed staff value (staff | staff2).
 * Runs before dev server starts to ensure environment is configured.
 */

import { existsSync, copyFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '..');
const envFile = resolve(projectRoot, '.env');
const envExampleFile = resolve(projectRoot, '.env.example');

const ALLOWED_PORTALS = ['staff', 'staff2', 'local'];

console.log('\n🔧 Syncing environment configuration...\n');

if (!existsSync(envFile)) {
  if (existsSync(envExampleFile)) {
    try {
      copyFileSync(envExampleFile, envFile);
      console.log('✅ Created .env file from .env.example');
      console.log('📝 Please review and update .env with your configuration\n');
    } catch (error) {
      console.error('❌ Failed to create .env file:', error.message);
      process.exit(1);
    }
  } else {
    console.error('❌ .env.example file not found!');
    process.exit(1);
  }
} else {
  console.log('✅ .env file already exists — keeping your settings');
}

// Validate VITE_DEV_PORTAL
const envContent = readFileSync(envFile, 'utf-8');
const match = envContent.match(/^VITE_DEV_PORTAL=(.+)$/m);
const portal = match ? match[1].trim() : null;

if (!portal) {
  console.warn('⚠️  VITE_DEV_PORTAL is not set — defaulting to "staff"');
} else if (!ALLOWED_PORTALS.includes(portal)) {
  console.error(`❌ Invalid VITE_DEV_PORTAL="${portal}" for mds-staff`);
  console.error(`   Allowed values: ${ALLOWED_PORTALS.join(', ')}`);
  process.exit(1);
}

console.log(`🌐 VITE_DEV_PORTAL = ${portal || 'staff (default)'}`);
console.log('✨ Environment setup complete\n');
