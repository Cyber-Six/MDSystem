# Database Setup Guide for AI Medical Chatbot

## Overview

The AI Medical Chatbot integrates with the existing **mdsystem** database using dedicated tables for AI functionality.

✅ **Single Database Benefits:**
- One database connection and backup
- Easy foreign key relationships with patients/staff tables
- Simpler deployment and maintenance
- Logical separation with table naming conventions

---

## Prerequisites

- PostgreSQL installed and running
- Access to existing database: `mdsystem`
- Database administrator credentials
- **Schema file**: Available on internal Google Drive (restricted access)

---

## Setup Steps

### 1. Obtain Schema File

**Important:** The database schema file is stored on the internal Google Drive for security reasons.

- **Location:** MDSystem Project > Database > AI Module Schema
- **Access:** Contact system administrator
- **Filename:** `ai_chatbot_schema.sql`

### 2. Execute SQL Schema

Once you have the schema file:

```bash
psql -U <db_user> -d mdsystem -f /path/to/ai_chatbot_schema.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE INDEX
CREATE VIEW
CREATE FUNCTION
CREATE TRIGGER
```

### 3. Verify Installation

Check that all required database objects were created:

```bash
# Verify tables
psql -U <db_user> -d mdsystem -c "\dt ai_*"
```

**Expected:** 3 tables with `ai_` prefix

```bash
# Verify views
psql -U <db_user> -d mdsystem -c "\dv"
```

**Expected:** 2 views for active monitoring and request management

### 4. Test Connection

```bash
psql -U <db_user> -d mdsystem -c "SELECT COUNT(*) FROM ai_conversations;"
```

**Expected:** `count: 0` (clean installation)

---

## Database Structure

The AI chatbot module uses three main tables and two views:

### Tables
1. **Conversations Table** - Manages chat sessions with status tracking
2. **Messages Table** - Stores all conversation messages with role identification
3. **Handoff Requests Table** - Handles staff escalation requests with priority levels

### Views
1. **Active Chats View** - Provides real-time monitoring of ongoing conversations
2. **Request Queue View** - Manages prioritized staff escalation requests

**Note:** Detailed schema information is available in the internal documentation for authorized personnel.

## Security Notes

### Permissions

Database user requires:
- `SELECT`, `INSERT`, `UPDATE` permissions on AI module tables
- Access to required views for monitoring
- Appropriate role-based access control

### Data Relationships

The schema includes:
- Foreign key constraints to existing system tables
- Referential integrity enforcement
- Cascading delete rules where appropriate

**Note:** Relationship details are configured in the schema file.

---

## Troubleshooting

### Connection Refused
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start if needed
sudo systemctl start postgresql
```

### Authentication Failed
```bash
# Update .env with correct credentials
DB_USER=<database_user>
DB_PASSWORD=<secure_password>
DB_NAME=mdsystem
```

### Tables Already Exist
```bash
# Contact database administrator for cleanup script
# Or use the cleanup commands in the schema documentation

# Then re-run schema file
psql -U <db_user> -d mdsystem -f /path/to/ai_chatbot_schema.sql
```

---

## Backup and Maintenance

### Backup AI Module
```bash
# Backup all AI module tables
pg_dump -U <db_user> -d mdsystem -t 'ai_*' > ai_module_backup.sql
```

### Restore AI Module
```bash
psql -U <db_user> -d mdsystem < ai_module_backup.sql
```

### Maintenance Tasks
```sql
-- Clean up old data (contact DBA for specific retention policy)
-- Automated cleanup is configured via scheduled jobs
```

---

## Next Steps

After database setup:

1. ✅ Update `.env` file with database credentials
2. ✅ Restart backend server
3. ✅ Test AI chat from frontend
4. ✅ Monitor logs for database connection success

---

## Important Notes

### Schema Access

- **Schema file is NOT in version control** for security
- Stored on internal Google Drive with restricted access
- Contact system administrator for schema access
- Never commit schema file to public repositories

### Database Architecture

- Integrated with existing `mdsystem` database
- Uses established relationships with core tables
- Maintains referential integrity
- See `DATABASE_ARCHITECTURE.md` for design decisions
