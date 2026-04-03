# User Preferences Settings API

## Overview

The User Preferences Settings API allows authenticated users to manage their application preferences, including appearance and notification settings. Preferences are stored as free-form JSONB data in the database with Redis caching for performance.

## Table of Contents

- [Endpoints](#endpoints)
- [Request/Response Format](#requestresponse-format)
- [Configuration](#configuration)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Caching Strategy](#caching-strategy)

## Endpoints

All endpoints require JWT authentication with `Authorization: Bearer {token}` header. Access is available to all authenticated users (patient and staff).

### GET /settings

Retrieve user preferences for the authenticated user.

**Request:**
```http
GET /settings HTTP/1.1
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "preferences": {
    "appearance": {
      "theme": "dark",
      "fontSize": 14,
      "language": "en"
    },
    "notification": {
      "emailAlerts": true,
      "pushNotifications": false
    }
  }
}
```

**Note:** If the user has no preferences yet, both objects default to `{}`.

---

### PUT /settings

Replace entire preferences (full update). Both fields are optional but at least one must be provided.

**Request:**
```http
PUT /settings HTTP/1.1
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "appearance": {
    "theme": "light",
    "fontSize": 16,
    "language": "tl"
  },
  "notification": {
    "emailAlerts": false,
    "pushNotifications": true
  }
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "preferences": {
    "appearance": {
      "theme": "light",
      "fontSize": 16,
      "language": "tl"
    },
    "notification": {
      "emailAlerts": false,
      "pushNotifications": true
    }
  },
  "message": "Preferences updated successfully"
}
```

---

### PATCH /settings

Partial update - merges new values with existing preferences instead of replacing them.

**Request:**
```http
PATCH /settings HTTP/1.1
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "appearance": {
    "theme": "light"
  }
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "preferences": {
    "appearance": {
      "theme": "light",
      "fontSize": 14,
      "language": "en"
    },
    "notification": {
      "emailAlerts": true,
      "pushNotifications": false
    }
  },
  "message": "Preferences partially updated successfully"
}
```

**Behavior:**
- Existing values not mentioned in the request are preserved
- New keys are added, existing keys are updated
- Deep merge is performed at the object level

---

### DELETE /settings

Reset preferences to empty defaults.

**Request:**
```http
DELETE /settings HTTP/1.1
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "preferences": {
    "appearance": {},
    "notification": {}
  },
  "message": "Preferences reset successfully"
}
```

---

## Request/Response Format

### Data Types

The API accepts any valid JSON structure within the free-form JSONB fields:

```javascript
// Valid structures (examples):
{
  "appearance": {
    "theme": "dark",           // string
    "fontSize": 14,            // number
    "bold": true,              // boolean
    "colors": {                // nested object
      "primary": "#FF5733",
      "secondary": "#33FF00"
    },
    "sidebar": ["menu", "search"],  // arrays
    "nullValue": null          // null
  }
}
```

### Size Constraints

| Limit | Default | Configurable | Environment Variable |
|-------|---------|--------------|----------------------|
| Max Total Size | 100 KB | Yes | `PREF_MAX_TOTAL_SIZE` |

Size is calculated as the byte length of the JSON stringified combined preferences object.

---

## Configuration

### Environment Variables

Add these to `.env`:

```env
# User preferences size limit (in bytes)
PREF_MAX_TOTAL_SIZE=102400              # 100KB max size for all preferences combined

# Cache TTL (in seconds)
PREF_CACHE_TTL=3600                     # 1 hour cache TTL
```

### Default Values

If environment variables are not set:
- `PREF_MAX_TOTAL_SIZE`: 100 KB (102400 bytes)
- `PREF_CACHE_TTL`: 1 hour (3600 seconds)

---

## Examples

### Example 1: Set Dark Mode Theme

```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appearance": {
      "theme": "dark",
      "sidebarCollapsed": true
    }
  }'
```

### Example 2: Update Notification Preferences (Partial)

```bash
curl -X PATCH http://localhost:3000/api/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notification": {
      "emailAlerts": false,
      "reminderTime": "09:00"
    }
  }'
```

### Example 3: Fetch Current Settings

```bash
curl -X GET http://localhost:3000/api/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example 4: Reset to Defaults

```bash
curl -X DELETE http://localhost:3000/api/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Error Handling

### 400 Bad Request

**Missing Fields:**
```json
{
  "error": "EMPTY_UPDATE",
  "message": "At least one preference field (appearance or notification) must be provided"
}
```

### 401 Unauthorized

**Missing Token:**
```json
{
  "error": "TOKEN_REQUIRED",
  "message": "Authorization header missing"
}
```

**Invalid Token:**
```json
{
  "error": "INVALID_TOKEN",
  "message": "JWT verification failed"
}
```

### 413 Payload Too Large

**Size Exceeded:**
```json
{
  "error": "PREFERENCES_TOO_LARGE",
  "message": "Preferences exceed max size: 150000 bytes > 102400 bytes",
  "limits": {
    "maxTotalSize": 102400
  }
}
```

### 500 Internal Server Error

**Database Error:**
```json
{
  "error": "PREFERENCES_UPDATE_FAILED",
  "message": "Failed to update preferences"
}
```

**Cache Error (non-blocking):**
```json
{
  "error": "PREFERENCES_FETCH_FAILED",
  "message": "Failed to retrieve preferences"
}
```

---

## Caching Strategy

### How Caching Works

1. **GET Request:**
   - Checks Redis cache first (key: `prefs:{userId}`)
   - If found and valid, returns cached data
   - If not cached, fetches from database and caches for `PREF_CACHE_TTL` seconds

2. **PUT/PATCH Request:**
   - Updates database immediately
   - Invalidates cache entry
   - Next GET request will fetch fresh data from database

3. **DELETE Request:**
   - Resets preferences in database
   - Invalidates cache entry

### Cache TTL

Default: **1 hour (3600 seconds)**

Configure via environment variable:
```env
PREF_CACHE_TTL=1800  # 30 minutes
PREF_CACHE_TTL=7200  # 2 hours
```

### Cache Key Format

```
prefs:{userId}
```

Example: `prefs:42`

### Redis Client Integration

The implementation uses the existing Redis client from `config/redis.js`:

```javascript
// Cache operations are transparent to the endpoint
const cached = await redis.getKey(key);      // Retrieve
await redis.setKey(key, value, ttl);         // Store with TTL
await redis.delKey(key);                     // Remove
```

---

## Database Schema

### UsersPreferences Table

```sql
CREATE TABLE "UsersPreferences" (
  id        INTEGER PRIMARY KEY REFERENCES "Users"(id),
  appearance JSONB DEFAULT '{}'::jsonb,
  notification JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Query Functions

Located in `Backend/config/query.js`:

```javascript
// Fetch user preferences
const prefs = await query.getUserPreferences(userId);
// Returns: { appearance: {...}, notification: {...} } or null

// Update user preferences (creates if not exists)
const updated = await query.setUserPreferences(userId, {
  appearance: { theme: "dark" },
  notification: { emailAlerts: true }
});
// Returns: { appearance: {...}, notification: {...} }
```

---

## Integration Points

### Files Modified/Created

| File | Change |
|------|--------|
| `Backend/routes/settings/settings.js` | **New** - Main route implementation |
| `Backend/routes/settings/index.js` | **New** - Route export |
| `Backend/config/query.js` | **Modified** - Added preference query functions |
| `Backend/server.js` | **Modified** - Mounted settings route at `/settings` |
| `Backend/staff.js` | **Modified** - Mounted settings route at `/settings` |
| `Backend/.env` | **Modified** - Added configuration variables |

### Route Registration

**Patient Portal (server.js):**
```javascript
const settingsRoutes = require('./routes/settings/settings.js');
app.use('/settings', settingsRoutes);
```

**Staff Portal (staff.js):**
```javascript
const settingsRoutes = require('./routes/settings/settings.js');
app.use('/settings', settingsRoutes);
```

---

## Security Considerations

1. **User Isolation:** Each user can only access their own preferences via `req.user.id`
2. **Size Validation:** Prevents abuse of free-form JSONB storage
3. **JWT Protection:** All endpoints require valid JWT authentication
4. **Error Logging:** All operations logged with user context for audit trail

---

## Performance Notes

- **Cache Hit:** Subsequent GET requests within TTL window (~100ms latency)
- **Cache Miss:** First request or after update (~50-200ms depending on DB)
- **Size Check:** Minimal overhead (~1ms) - JSON stringification only on update
- **Database:** Uses UPSERT pattern for atomic updates (INSERT ... ON CONFLICT)

---

## Future Enhancements

- Per-field encryption for sensitive preferences
- Preferences versioning/rollback
- Bulk export/import of preferences
- Administrative override capability
- Preference validation schema enforcement
