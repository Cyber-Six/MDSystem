# Google Sheets Integration Guide

This guide explains how to integrate your Google Sheets data (API endpoints, layouts, etc.) into the MDSystem project.

## 📋 Overview

The `fetch-sheets-config.js` script automatically fetches data from your Google Sheets and converts it into JSON files that are easy to use in your code and readable by Copilot.

## 🚀 Quick Start

### 1. Prepare Your Google Sheets

#### For API Endpoints Sheet:
Create a sheet with these columns:
- **Module**: e.g., "auth", "patient", "admin"
- **Method**: GET, POST, PUT, DELETE
- **Endpoint**: e.g., "/api/auth/login"
- **Description**: What the endpoint does
- **RequiresAuth**: Yes/No or true/false
- **Params**: Semicolon-separated list (e.g., "email;password;recaptchaToken")
- **Response**: Expected response format

Example:
```
Module  | Method | Endpoint              | Description          | RequiresAuth | Params                  | Response
--------|--------|----------------------|----------------------|--------------|------------------------|----------
auth    | POST   | /api/auth/login      | User login           | No           | email;password         | {token, user}
auth    | POST   | /api/auth/refresh    | Refresh access token | Yes          | refreshToken           | {accessToken}
patient | GET    | /api/patient/info    | Get patient info     | Yes          | patientId              | {patient}
```

#### For Layouts Sheet:
Create a sheet with these columns:
- **Page**: e.g., "Dashboard", "Login", "Profile"
- **Component**: Component name
- **Type**: "header", "content", "sidebar", "footer"
- **Props**: JSON object as string (e.g., `{"title": "Welcome", "showLogo": true}`)
- **Children**: Semicolon-separated list of child components
- **Order**: Number for ordering (0, 1, 2, etc.)

Example:
```
Page      | Component    | Type    | Props                           | Children           | Order
----------|--------------|---------|--------------------------------|-------------------|-------
Dashboard | NavBar       | header  | {"height": "80px"}             |                   | 0
Dashboard | StatsWidget  | content | {"title": "Statistics"}        | Chart;Table       | 1
Dashboard | Sidebar      | sidebar | {"collapsed": false}           | Menu;UserProfile  | 0
```

### 2. Publish Your Sheets

For each sheet/tab you want to use:

1. Open your Google Sheet
2. Go to **File > Share > Publish to web**
3. Select the specific **sheet/tab** (e.g., "API Endpoints")
4. Choose format: **Comma-separated values (.csv)**
5. Click **Publish**
6. Copy the generated URL

The URL will look like:
```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQxxx.../pub?gid=123456789&single=true&output=csv
```

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your published sheet URLs:
   ```env
   ENDPOINTS_SHEET_URL=https://docs.google.com/spreadsheets/d/e/YOUR_ENDPOINTS_SHEET_URL/pub?gid=xxx&single=true&output=csv
   LAYOUTS_SHEET_URL=https://docs.google.com/spreadsheets/d/e/YOUR_LAYOUTS_SHEET_URL/pub?gid=xxx&single=true&output=csv
   ```

### 4. Run the Script

```bash
# Fetch and generate config files
npm run fetch-config

# Or run automatically when starting dev server
npm run dev
```

## 📁 Generated Files

The script creates JSON files in `src/config/generated/`:

- `api-endpoints.json` - All your API endpoints organized by module
- `layouts.json` - All your layout configurations organized by page

Example `api-endpoints.json`:
```json
{
  "auth": [
    {
      "method": "POST",
      "path": "/api/auth/login",
      "description": "User login",
      "requiresAuth": false,
      "params": ["email", "password"],
      "response": "{token, user}"
    }
  ],
  "patient": [
    {
      "method": "GET",
      "path": "/api/patient/info",
      "description": "Get patient info",
      "requiresAuth": true,
      "params": ["patientId"],
      "response": "{patient}"
    }
  ]
}
```

## 💻 Using the Generated Config

### In Your Code

```javascript
// Import the generated endpoints
import endpoints from '@/config/generated/api-endpoints.json';

// Use in your API calls
const loginEndpoint = endpoints.auth.find(e => e.path.includes('login'));
console.log(loginEndpoint.method); // POST
console.log(loginEndpoint.path);   // /api/auth/login

// Dynamic route builder
function buildApiUrl(module, action) {
  const endpoint = endpoints[module].find(e => e.path.includes(action));
  return endpoint ? endpoint.path : null;
}

const loginUrl = buildApiUrl('auth', 'login'); // /api/auth/login
```

### For Copilot Context

Copilot can now read these JSON files to understand your API structure:
- Suggest correct endpoint paths
- Know which endpoints require authentication
- Understand expected parameters
- Provide better autocomplete

## 🔄 Updating Configuration

When you update your Google Sheets:

1. Make changes in Google Sheets
2. Run `npm run fetch-config` to pull latest data
3. Generated JSON files will be updated automatically
4. Commit the updated JSON files to version control

## 🛠️ Advanced Usage

### Automatic Fetching on Dev Start

To automatically fetch configs when starting the dev server, the script is already set up to run before Vite starts (via predev script).

### TypeScript Support

Create type definitions for better autocomplete:

```typescript
// src/types/config.ts
export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  requiresAuth: boolean;
  params: string[];
  response: string;
}

export interface Endpoints {
  [module: string]: ApiEndpoint[];
}

export interface LayoutComponent {
  component: string;
  type: string;
  props: Record<string, any>;
  children: string[];
  order: number;
}

export interface Layouts {
  [page: string]: LayoutComponent[];
}
```

### Custom Transformations

Edit `scripts/fetch-sheets-config.js` to customize how data is transformed:

```javascript
function transformEndpoints(rawData) {
  // Add your custom transformation logic here
  // Example: Convert snake_case to camelCase
  // Example: Validate required fields
  // Example: Add computed properties
}
```

## 📝 Tips for Google Sheets

1. **Use Data Validation**: Set up dropdowns for columns like Method, Type, RequiresAuth
2. **Keep it Simple**: Avoid complex merged cells - the script works best with simple tables
3. **Document Headers**: Add a row with descriptions of each column
4. **Version Control**: Keep track of sheet versions in your documentation
5. **Separate Sheets**: Use different sheets/tabs for different concerns (endpoints, layouts, constants)

## 🔒 Security

- The published sheet URLs are public but read-only
- Don't put sensitive data (API keys, passwords) in these sheets
- Use environment variables for sensitive configuration
- The generated JSON files can be committed to Git (they contain only structure, not secrets)

## 🐛 Troubleshooting

### Script fails to fetch data
- Check that the sheet is published to web (File > Share > Publish to web)
- Verify the URL is for CSV format (`output=csv` at the end)
- Make sure the sheet is not empty

### Generated data looks wrong
- Check column names match exactly (case-sensitive)
- Ensure no extra commas in cell values (escape with quotes if needed)
- Verify data types (true/false for booleans, numbers for Order)

### Import errors in code
- Make sure `src/config/generated/` exists
- Run `npm run fetch-config` at least once
- Check Vite config allows JSON imports

## 🎯 Best Practices

1. Run `fetch-config` regularly to keep data in sync
2. Commit generated JSON files to version control
3. Document your sheet structure in this guide
4. Use consistent naming conventions across sheets
5. Keep sheets focused - one concern per sheet
6. Add validation rules in Google Sheets to prevent errors
