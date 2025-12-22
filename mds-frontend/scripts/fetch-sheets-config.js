/**
 * Google Sheets Configuration Fetcher
 * Fetches API endpoints from Google Sheets
 * and converts them to JSON format for easy consumption
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load environment variables from .env.local file
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, '../.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.warn('⚠️  .env.local file not found');
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim();
    
    if (key && value) {
      process.env[key] = value;
    }
  });
}

// Load environment variables
loadEnvFile();

// Configuration
const CONFIG = {
  // Google Sheets published CSV URL
  ENDPOINTS_SHEET_URL: process.env.ENDPOINTS_SHEET_URL || 'YOUR_ENDPOINTS_SHEET_URL_HERE',
  
  // Output paths
  OUTPUT_DIR: path.join(__dirname, './generated'),
  ENDPOINTS_OUTPUT: 'api-endpoints.json',
};

/**
 * Fetch data from a published Google Sheet (CSV format)
 */
async function fetchSheetData(url) {
  if (url.includes('YOUR_') || !url) {
    console.warn('⚠️  Sheet URL not configured. Please set up your Google Sheets URLs.');
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    return csvText;
  } catch (error) {
    console.error(`Error fetching sheet data: ${error.message}`);
    return null;
  }
}

/**
 * Parse CSV text to array of objects
 * Handles proper CSV parsing including quoted fields with commas
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse a CSV line respecting quotes
  function parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Skip empty rows
    if (Object.values(row).some(v => v !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Transform endpoint data to structured format
 * Custom parser for MDSystem Google Sheets layout
 */
function transformEndpoints(rawCSVText) {
  const endpoints = {};
  const lines = rawCSVText.split('\n');
  
  // Find the header row (contains "Directory Routes")
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Directory Routes')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    console.warn('⚠️  Could not find header row with "Directory Routes"');
    return endpoints;
  }
  
  console.log(`   Found headers at row ${headerIndex + 1}`);
  
  // Parse CSV line respecting quotes
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
  
  // Process rows after the header
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = parseCSVLine(line);
    
    // Column indices (0-based, accounting for empty leading columns)
    const segmentation = (cols[2] || '').replace(/"/g, ''); // Column C
    const directoryRoutes = (cols[3] || '').replace(/"/g, ''); // Column D
    const subRoutes = (cols[4] || '').replace(/"/g, ''); // Column E
    const url = (cols[5] || '').replace(/"/g, ''); // Column F
    const method = (cols[6] || '').replace(/"/g, ''); // Column G
    const attribute = (cols[7] || '').replace(/"/g, ''); // Column H
    const datatype = (cols[8] || '').replace(/"/g, ''); // Column I
    const required = (cols[9] || '').replace(/"/g, ''); // Column J
    const returns = (cols[10] || '').replace(/"/g, ''); // Column K
    
    // Skip rows without a method (likely parameter continuation rows)
    if (!method || method.trim() === '') continue;
    
    // Use segmentation as module name, fallback to directory
    let moduleName = segmentation || directoryRoutes.replace(/^\//, '') || 'general';
    moduleName = moduleName.trim().replace(/\s+/g, '-').toLowerCase();
    
    if (!endpoints[moduleName]) {
      endpoints[moduleName] = [];
    }
    
    // Build the endpoint path
    const endpointPath = subRoutes || directoryRoutes || url;
    
    // Create new endpoint
    const params = [];
    if (attribute) {
      params.push({
        name: attribute,
        type: datatype || 'string',
        required: required === 'Y' || required === 'Yes' || required === 'true'
      });
    }
    
    endpoints[moduleName].push({
      method: method.toUpperCase(),
      path: endpointPath,
      fullUrl: url,
      description: segmentation || moduleName,
      params: params,
      response: returns || '',
      requiresAuth: segmentation.toLowerCase().includes('auth') || directoryRoutes.includes('/auth')
    });
  }
  
  return endpoints;
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    console.log(`✅ Created output directory: ${CONFIG.OUTPUT_DIR}`);
  }
}

/**
 * Save JSON data to file
 */
function saveJSON(filename, data) {
  const filePath = path.join(CONFIG.OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Saved: ${filePath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Fetching Google Sheets configuration...\n');

  ensureOutputDir();

  // Fetch and process endpoints
  console.log('📊 Fetching API endpoints...');
  const endpointsCSV = await fetchSheetData(CONFIG.ENDPOINTS_SHEET_URL);
  if (endpointsCSV) {
    // Save raw CSV for debugging
    const debugPath = path.join(CONFIG.OUTPUT_DIR, 'raw-endpoints.csv');
    fs.writeFileSync(debugPath, endpointsCSV, 'utf-8');
    console.log(`   📄 Raw CSV saved to: ${debugPath}`);
    console.log(`   Raw CSV length: ${endpointsCSV.length} characters`);
    
    // Pass raw CSV text to transformer instead of parsed data
    const endpoints = transformEndpoints(endpointsCSV);
    saveJSON(CONFIG.ENDPOINTS_OUTPUT, endpoints);
    console.log(`   ✅ Found ${Object.keys(endpoints).length} endpoint modules:`);
    Object.keys(endpoints).forEach(module => {
      console.log(`      - ${module}: ${endpoints[module].length} endpoints`);
    });
    console.log('');
  } else {
    console.log('   ⚠️  Skipped (not configured)\n');
  }

  console.log('✨ Done! Endpoint configuration generated successfully.');
  console.log('\n📝 Next steps:');
  console.log('   1. Import in your code: import endpoints from "@/config/generated/api-endpoints.json"');
  console.log('   2. Use TypeScript for autocomplete (optional): Add type definitions');
  console.log('   3. Re-run this script when sheets are updated: npm run fetch-config\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
