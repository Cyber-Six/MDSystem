# Database Architecture Decision: Same Database vs Separate Database

## Recommendation: **Use Existing `mdsystem` Database** ✅

---

## Comparison

| Aspect | Same Database (`mdsystem`) | Separate Database (`mdsystem_ai`) |
|--------|---------------------------|-----------------------------------|
| **Setup Complexity** | ✅ Simple - run schema file | ⚠️ Create new database + schema |
| **Backup Strategy** | ✅ Single backup covers all | ⚠️ Need two separate backups |
| **Connection Management** | ✅ Single connection pool | ⚠️ Two connection pools |
| **Foreign Key Relationships** | ✅ Direct FK to patients/staff tables | ❌ Cannot use foreign keys across DBs |
| **Data Integrity** | ✅ Referential integrity enforced | ⚠️ Manual integrity checks needed |
| **Queries Across Data** | ✅ Simple JOINs | ❌ Complex cross-DB queries |
| **Deployment** | ✅ One database to configure | ⚠️ Two databases to manage |
| **Resource Usage** | ✅ Shared connection pool | ⚠️ More connections needed |
| **Isolation** | ⚠️ Tables in same namespace | ✅ Fully isolated namespace |
| **Permissions** | ✅ Single user/role management | ⚠️ Separate permissions needed |

---

## Why Use Same Database?

### 1. **Referential Integrity**
The schema establishes foreign key relationships with existing system tables, ensuring:
- Data consistency across modules
- Automatic integrity enforcement
- Proper cascade behavior

*Note: Specific relationship definitions are in the schema file (Google Drive).*

### 2. **Simple Queries**
Integrated database allows efficient queries across modules:
- Join patient data with AI conversations
- Link staff assignments to requests
- Generate comprehensive reports

*Implementation details available in internal documentation.*

### 3. **Single Backup**
```bash
# One command backs up entire system
pg_dump -U <db_user> mdsystem > full_backup.sql

# Restore everything at once
psql -U <db_user> mdsystem < full_backup.sql
```

### 4. **Logical Separation**
Tables use consistent naming conventions for easy identification:
- All AI module tables use `ai_` prefix
- Related views follow naming conventions
- Clear logical grouping for queries and management

Easy to identify, query, and manage as a cohesive module.

---

## Implementation

### Schema Location
**Important:** The database schema is stored on internal Google Drive for security.

- **Access:** Contact system administrator
- **File:** `ai_chatbot_schema.sql`
- **Documentation:** Available with schema file

### Setup Command
```bash
# Run schema against existing mdsystem database
psql -U <db_user> -d mdsystem -f /path/to/ai_chatbot_schema.sql
```

### .env Configuration
```env
# Use existing database credentials
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mdsystem
DB_USER=<database_user>
DB_PASSWORD=<secure_password>
```

### No Code Changes Needed
The backend `config/db.js` already connects to `mdsystem`:
```javascript
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME, // mdsystem
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
```

---

## When to Use Separate Database?

Consider separate database if:

❌ **AI chatbot is a separate product**
- Completely different team/codebase
- Independent deployment schedule
- Different backup/restore needs

❌ **Strict data isolation required**
- Regulatory compliance for AI data
- Different security clearance levels
- Multi-tenancy with strict boundaries

❌ **Different database technology**
- AI uses MongoDB, main uses PostgreSQL
- Different performance characteristics needed

**None of these apply to MDSystem** → Use same database.

---

## Migration Path

If future separation is needed:

```bash
# 1. Dump AI module tables
pg_dump -U <db_user> -d mdsystem -t 'ai_*' > ai_module_export.sql

# 2. Create new database (if required)
psql -U postgres -c "CREATE DATABASE mdsystem_ai OWNER <db_user>;"

# 3. Import to new database
psql -U <db_user> -d mdsystem_ai < ai_module_export.sql

# 4. Update application configuration
# Contact administrator for migration guidance
```

**Note:** Migration requires careful planning to handle foreign key relationships.

---

## Conclusion

✅ **Recommendation: Use `mdsystem` database** with AI module integration

**Reasons:**
1. Simpler setup and maintenance
2. Foreign key relationships maintained
3. Single backup/restore process
4. Better query performance
5. Logical separation via naming conventions

**Setup:**
```bash
# Schema file available on internal Google Drive
psql -U <db_user> -d mdsystem -f /path/to/ai_chatbot_schema.sql
```

**Configuration:** Uses existing `.env` database credentials.

---

## Questions & Answers

**Q: Won't AI tables clutter the main database?**  
A: No. With consistent naming prefix, tables are easy to identify and manage. The module adds only 3 tables and 2 views.

**Q: What if I need different backup schedules?**  
A: Use table-specific dumps with wildcard patterns:
```bash
pg_dump -U <db_user> -d mdsystem -t 'ai_*' > ai_module_backup.sql
```

**Q: Can I still isolate permissions?**  
A: Yes, through role-based access control configured in the schema.

**Q: What about performance impact?**  
A: Minimal. AI module tables are properly indexed for optimal performance. The module is designed for efficient query execution.

---

**Decision: Use existing `mdsystem` database.** ✅
