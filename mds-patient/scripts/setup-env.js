#!/usr/bin/env node

/**
 * Environment Setup Script — mds-patient
 *
 * Automatically syncs .env from .env.example on every run.
 * Runs before dev server starts to ensure environment is configured.
 */

import { existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '..');
const envFile = resolve(projectRoot, '.env');
const envExampleFile = resolve(projectRoot, '.env.example');

console.log('\n🔧 Syncing environment configuration...\n');

if (existsSync(envExampleFile)) {
  try {
    copyFileSync(envExampleFile, envFile);
    if (existsSync(envFile) && envFile !== envExampleFile) {
      console.log('✅ Synced .env file from .env.example');
    } else {
      console.log('✅ Created .env file from .env.example');
    }
    console.log('📝 Please review and update .env with your configuration\n');
  } catch (error) {
    console.error('❌ Failed to sync .env file:', error.message);
    process.exit(1);
  }
} else {
  console.error('❌ .env.example file not found!');
  process.exit(1);
}

console.log('✨ Environment setup complete\n');
