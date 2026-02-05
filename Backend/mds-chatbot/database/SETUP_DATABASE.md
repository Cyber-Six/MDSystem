# Database Setup Guide for AI Medical Chatbot

## Overview

The AI Medical Chatbot uses the existing **mdsystem** database with dedicated tables for AI functionality. This approach provides:

✅ **Single Database Benefits:**
- One database connection and backup
- Easy foreign key relationships with patients/staff tables
- Simpler deployment and maintenance
- Logical separation through table prefixes (`ai_*`)

---

## Prerequisites

- PostgreSQL installed and running
- Database: `mdsystem`
- User: `mdsadmin` (with appropriate permissions)
- Schema file: `Backend/mds-chatbot/database/schema.sql`

---

## Setup Steps

### 1. Execute SQL Schema

Run the following command from your project root:

```bash
psql -U mdsadmin -d mdsystem -f Backend/mds-chatbot/database/schema.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE VIEW
```

### 2. Verify Tables Created

```bash
psql -U mdsadmin -d mdsystem -c "\dt ai_*"
```

**Expected Tables:**
- `ai_conversations` - Patient chat sessions
- `ai_messages` - Individual messages
- `ai_handoff_requests` - Staff takeover requests

### 3. Verify Views Created

```bash
psql -U mdsadmin -d mdsystem -c "\dv ai_*"
```

**Expected View:**
- `ai_active_conversations` - Active patient chats

### 4. Test Database Connection

```bash
psql -U mdsadmin -d mdsystem -c "SELECT COUNT(*) FROM ai_conversations;"
```

**Expected:** `count: 0` (no conversations yet)

---

## Table Structure

### `ai_conversations`
Stores patient chat sessions.

| Column | Type | Description |
|--------|------|-------------|
| `conversation_id` | UUID | Primary key |
| `patient_id` | VARCHAR(50) | Patient identifier |
| `started_at` | TIMESTAMP | Session start time |
| `ended_at` | TIMESTAMP | Session end time (NULL if active) |
| `status` | VARCHAR(20) | `active`, `completed`, `handed_off` |
| `handoff_to_staff_id` | VARCHAR(50) | Staff ID for handoff |
| `handoff_reason` | TEXT | Reason for staff handoff |
| `metadata` | JSONB | Additional session data |

### `ai_messages`
Stores individual messages within conversations.

| Column | Type | Description |
|--------|------|-------------|
| `message_id` | UUID | Primary key |
| `conversation_id` | UUID | Foreign key to conversation |
| `sender_type` | VARCHAR(20) | `patient`, `ai`, `staff` |
| `sender_id` | VARCHAR(50) | Sender identifier |
| `message_content` | TEXT | Message text |
| `sent_at` | TIMESTAMP | Message timestamp |
| `is_emergency_flagged` | BOOLEAN | Emergency keyword detected |
| `metadata` | JSONB | Additional message data |

### `ai_handoff_requests`
Tracks staff takeover requests.

| Column | Type | Description |
|--------|------|-------------|
| `request_id` | UUID | Primary key |
| `conversation_id` | UUID | Foreign key to conversation |
| `requested_at` | TIMESTAMP | Request time |
| `reason` | TEXT | Handoff reason |
| `priority` | VARCHAR(20) | `low`, `medium`, `high`, `emergency` |
| `assigned_staff_id` | VARCHAR(50) | Assigned staff member |
| `status` | VARCHAR(20) | `pending`, `accepted`, `completed` |

---

## Security Notes

### Permissions

The `mdsadmin` user needs:
```sql
GRANT SELECT, INSERT, UPDATE ON ai_conversations TO mdsadmin;
GRANT SELECT, INSERT, UPDATE ON ai_messages TO mdsadmin;
GRANT SELECT, INSERT, UPDATE ON ai_handoff_requests TO mdsadmin;
```

### Foreign Key Relationships

If you have `patients` and `staff` tables, you can add foreign keys:

```sql
-- Link ai_conversations to patients table
ALTER TABLE ai_conversations 
ADD CONSTRAINT fk_patient 
FOREIGN KEY (patient_id) REFERENCES patients(patient_id);

-- Link ai_handoff_requests to staff table
ALTER TABLE ai_handoff_requests 
ADD CONSTRAINT fk_assigned_staff 
FOREIGN KEY (assigned_staff_id) REFERENCES staff(staff_id);
```

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
DB_USER=mdsadmin
DB_PASSWORD=your_password_here
DB_NAME=mdsystem
```

### Tables Already Exist
```sql
-- Drop existing tables (WARNING: Deletes all data)
DROP TABLE IF EXISTS ai_messages CASCADE;
DROP TABLE IF EXISTS ai_handoff_requests CASCADE;
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP VIEW IF EXISTS ai_active_conversations;

-- Then re-run schema.sql
```

---

## Backup and Maintenance

### Backup AI Tables
```bash
pg_dump -U mdsadmin -d mdsystem -t ai_conversations -t ai_messages -t ai_handoff_requests > ai_backup.sql
```

### Restore AI Tables
```bash
psql -U mdsadmin -d mdsystem < ai_backup.sql
```

### Clean Up Old Conversations
```sql
-- Delete completed conversations older than 90 days
DELETE FROM ai_conversations 
WHERE status = 'completed' 
AND ended_at < NOW() - INTERVAL '90 days';
```

---

## Next Steps

After database setup:

1. ✅ Update `.env` file with database credentials
2. ✅ Restart backend server
3. ✅ Test AI chat from frontend
4. ✅ Monitor logs for database connection success

---

## Alternative: Separate Database

If you prefer a separate database for AI chatbot:

```bash
# Create new database
psql -U postgres -c "CREATE DATABASE mdsystem_ai OWNER mdsadmin;"

# Run schema
psql -U mdsadmin -d mdsystem_ai -f Backend/mds-chatbot/database/schema.sql

# Update .env
DB_NAME=mdsystem_ai
```

**Note:** Separate database loses foreign key relationships with main `mdsystem` database.
