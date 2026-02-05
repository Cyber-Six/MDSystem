# Database Architecture Decision: Same Database vs Separate Database

## Recommendation: **Use Existing `mdsystem` Database** ✅

---

## Comparison

| Aspect | Same Database (`mdsystem`) | Separate Database (`mdsystem_ai`) |
|--------|---------------------------|-----------------------------------|
| **Setup Complexity** | ✅ Simple - just run schema.sql | ⚠️ Create new database + schema |
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
```sql
-- Can create foreign keys to patients table
ALTER TABLE ai_conversations 
ADD CONSTRAINT fk_patient 
FOREIGN KEY (patient_id) REFERENCES patients(patient_id);

-- Can create foreign keys to staff table
ALTER TABLE ai_handoff_requests 
ADD CONSTRAINT fk_assigned_staff 
FOREIGN KEY (assigned_staff_id) REFERENCES staff(staff_id);
```

### 2. **Simple Queries**
```sql
-- Get patient info with AI conversation in ONE query
SELECT 
  p.patient_name,
  p.email,
  c.started_at,
  c.status
FROM patients p
JOIN ai_conversations c ON p.patient_id = c.patient_id
WHERE c.status = 'active';
```

### 3. **Single Backup**
```bash
# One command backs up everything
pg_dump -U mdsadmin mdsystem > full_backup.sql

# Restore everything at once
psql -U mdsadmin mdsystem < full_backup.sql
```

### 4. **Logical Separation**
Tables are clearly prefixed with `ai_*`:
- `ai_conversations`
- `ai_messages`
- `ai_handoff_requests`
- `ai_active_conversations` (view)

Easy to identify, query, and manage as a group.

---

## Implementation

### Setup Command
```bash
# Run schema against existing mdsystem database
psql -U mdsadmin -d mdsystem -f Backend/mds-chatbot/database/schema.sql
```

### .env Configuration
```env
# Use existing database credentials
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mdsystem
DB_USER=mdsadmin
DB_PASSWORD=your_password
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

If you later need to separate:

```bash
# 1. Dump AI tables
pg_dump -U mdsadmin -d mdsystem \
  -t ai_conversations \
  -t ai_messages \
  -t ai_handoff_requests \
  > ai_tables.sql

# 2. Create new database
psql -U postgres -c "CREATE DATABASE mdsystem_ai OWNER mdsadmin;"

# 3. Restore AI tables
psql -U mdsadmin -d mdsystem_ai < ai_tables.sql

# 4. Update .env
DB_NAME=mdsystem_ai

# 5. Drop from original (optional)
psql -U mdsadmin -d mdsystem -c "DROP TABLE ai_conversations CASCADE;"
```

---

## Conclusion

✅ **Use `mdsystem` database** with `ai_*` tables

**Reasons:**
1. Simpler setup and maintenance
2. Foreign key relationships work
3. Single backup/restore process
4. Better query performance
5. Logical separation via naming

**Setup:**
```bash
psql -U mdsadmin -d mdsystem -f Backend/mds-chatbot/database/schema.sql
```

**No changes needed in `.env` or backend code.**

---

## Questions & Answers

**Q: Won't AI tables clutter the main database?**  
A: No. With `ai_*` prefix, they're easy to identify. Many databases have 50+ tables - this adds only 3 tables + 1 view.

**Q: What if I need different backup schedules?**  
A: Use table-specific dumps:
```bash
pg_dump -U mdsadmin -d mdsystem -t 'ai_*' > ai_backup.sql
```

**Q: Can I still isolate permissions?**  
A: Yes:
```sql
-- Create AI-only role
CREATE ROLE ai_service LOGIN PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE ON ai_conversations TO ai_service;
GRANT SELECT, INSERT, UPDATE ON ai_messages TO ai_service;
GRANT SELECT, INSERT, UPDATE ON ai_handoff_requests TO ai_service;
```

**Q: What about performance impact?**  
A: Minimal. AI tables are small (< 10k rows typically). Indexed properly for fast queries.

---

**Decision: Use existing `mdsystem` database.** ✅
