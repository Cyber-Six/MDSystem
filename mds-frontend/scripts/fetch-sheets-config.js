/**
 * Layout Routes Configuration Fetcher
 * 
 * Fetches API endpoint routes from Google Sheets and converts to JSON.
 * Optimized for single sheet processing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
config({ path: path.join(__dirname, '../.env') });

// Configuration
const SHEET_URL = process.env.VITE_LAYOUT_ROUTES_SHEET_URL;
const OUTPUT_DIR = path.join(__dirname, './generated');
const OUTPUT_FILE = 'api-endpoints.json';

/**
 * Fetch data from published Google Sheet (CSV format)
 */
async function fetchSheetData(url) {
  if (!url || url.includes('YOUR_SHEET_ID')) {
    throw new Error('Sheet URL not configured. Please set VITE_LAYOUT_ROUTES_SHEET_URL in .env');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Parse CSV line respecting quotes and commas
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

/**
 * Transform CSV data to structured endpoint configuration
 */
function transformToEndpoints(csvText) {
  const lines = csvText.split('\n');
  const endpoints = {};
  
  // Find header row (contains "Directory Routes")
  const headerIndex = lines.findIndex(line => line.includes('Directory Routes'));
  if (headerIndex === -1) {
    throw new Error('Invalid sheet format: missing "Directory Routes" header');
  }
  
  // Process data rows
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = parseCSVLine(line);
    
    // Column mapping (0-indexed)
    const segmentation = cols[2] || '';     // C: Module/segmentation
    const directoryRoutes = cols[3] || '';  // D: Directory route
    const subRoutes = cols[4] || '';        // E: Sub-route
    const url = cols[5] || '';              // F: Full URL
    const method = cols[6] || '';           // G: HTTP method
    const attribute = cols[7] || '';        // H: Parameter name
    const datatype = cols[8] || '';         // I: Data type
    const required = cols[9] || '';         // J: Required flag
    const returns = cols[10] || '';         // K: Response description
    
    // Skip rows without HTTP method (parameter continuation rows)
    if (!method) continue;
    
    // Determine module name
    const moduleName = (segmentation || directoryRoutes.replace(/^\//, '') || 'general')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    
    if (!endpoints[moduleName]) {
      endpoints[moduleName] = [];
    }
    
    // Build endpoint object
    const params = attribute ? [{
      name: attribute,
      type: datatype || 'string',
      required: ['Y', 'Yes', 'true'].includes(required)
    }] : [];
    
    endpoints[moduleName].push({
      method: method.toUpperCase(),
      path: subRoutes || directoryRoutes || url,
      fullUrl: url,
      description: segmentation || moduleName,
      params,
      response: returns,
      requiresAuth: segmentation.toLowerCase().includes('auth') || directoryRoutes.includes('/auth')
    });
  }
  
  return endpoints;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Fetching layout routes configuration...\n');

  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Fetch and process sheet
    console.log('📊 Fetching layout routes sheet...');
    const csvText = await fetchSheetData(SHEET_URL);
    
    // Save raw CSV for debugging
    const debugPath = path.join(OUTPUT_DIR, 'raw-layout-routes.csv');
    fs.writeFileSync(debugPath, csvText, 'utf-8');
    console.log(`   📄 Raw CSV saved: ${debugPath}`);
    
    // Transform to endpoints
    const endpoints = transformToEndpoints(csvText);
    
    // Save JSON output
    const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
    fs.writeFileSync(outputPath, JSON.stringify(endpoints, null, 2), 'utf-8');
    
    console.log(`\n✅ Generated: ${outputPath}`);
    console.log(`   Found ${Object.keys(endpoints).length} modules with routes:\n`);
    Object.entries(endpoints).forEach(([module, routes]) => {
      console.log(`   • ${module}: ${routes.length} endpoints`);
    });
    
    console.log('\n✨ Configuration generated successfully!');
    console.log('\n📝 Usage:');
    console.log('   import endpoints from "@/scripts/generated/api-endpoints.json"\n');
    
  } catch (error) {
    console.error('\n⚠️  Warning:', error.message);
    console.log('   Continuing without layout routes configuration...\n');
    // Don't exit with error - allow dev server to start anyway
  }
}

main();
