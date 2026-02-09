#!/usr/bin/env node

/**
 * Environment Setup Script
 * 
 * Automatically creates .env file from .env.example if it doesn't exist.
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

console.log('\n🔧 Checking environment configuration...\n');

if (existsSync(envFile)) {
  console.log('✅ .env file already exists');
} else if (existsSync(envExampleFile)) {
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

console.log('✨ Environment setup complete\n');
