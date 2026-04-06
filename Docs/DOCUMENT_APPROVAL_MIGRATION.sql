-- ============================================================
-- DOCUMENT APPROVAL WORKFLOW - DATABASE MIGRATION
-- ============================================================
-- Run this SQL in your PostgreSQL database to enable the 
-- document approval workflow with Rejected status and notes.
-- ============================================================

-- Step 1: Add 'Rejected' to the RawDocumentStatus enum
-- PostgreSQL doesn't allow direct modification of enums, so we need to add the new value
ALTER TYPE "RawDocumentStatus" ADD VALUE IF NOT EXISTS 'Rejected';

-- Step 2: Add reviewNotes column for staff feedback
ALTER TABLE "patientRawDocument" 
ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;

-- Step 3: Add requestNotes column for request context (optional - for staff to explain why they need the document)
ALTER TABLE "patientRawDocument" 
ADD COLUMN IF NOT EXISTS "requestNotes" TEXT;

-- ============================================================
-- VERIFICATION QUERIES (run these to confirm changes)
-- ============================================================

-- Check enum values:
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'RawDocumentStatus'::regtype;

-- Check table columns:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'patientRawDocument' ORDER BY ordinal_position;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- Note: PostgreSQL doesn't support removing enum values directly.
-- To rollback, you would need to:
-- 1. Update any 'Rejected' records to another status
-- 2. Recreate the enum without 'Rejected'
-- 3. Drop the reviewNotes and requestNotes columns:
--    ALTER TABLE "patientRawDocument" DROP COLUMN IF EXISTS "reviewNotes";
--    ALTER TABLE "patientRawDocument" DROP COLUMN IF EXISTS "requestNotes";
