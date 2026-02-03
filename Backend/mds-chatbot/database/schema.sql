/**
 * Database Migration: AI Medical Chatbot Tables
 * Run this to create the necessary tables for the chatbot system
 */

-- ============================================
-- AI Conversations Table
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  patient_id INT REFERENCES patients(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'ai-active' CHECK (status IN ('ai-active', 'staff-taken', 'closed')),
  staff_id INT REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_session_id (session_id),
  INDEX idx_patient_id (patient_id),
  INDEX idx_status (status),
  INDEX idx_staff_id (staff_id),
  INDEX idx_created_at (created_at)
);

-- ============================================
-- AI Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS ai_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'staff', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_role (role),
  INDEX idx_created_at (created_at),
  INDEX idx_metadata (metadata) USING GIN
);

-- ============================================
-- AI Handoff Requests Table
-- ============================================
CREATE TABLE IF NOT EXISTS ai_handoff_requests (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  reason VARCHAR(255),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'emergency')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'resolved')),
  assigned_staff_id INT REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  assigned_at TIMESTAMP,
  resolved_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_assigned_staff_id (assigned_staff_id),
  INDEX idx_created_at (created_at)
);

-- ============================================
-- Useful Views
-- ============================================

-- View: Active conversations with last message
CREATE OR REPLACE VIEW active_ai_chats AS
SELECT 
  c.id,
  c.session_id,
  c.patient_id,
  c.status,
  c.staff_id,
  c.created_at,
  c.updated_at,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at,
  (SELECT content FROM ai_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
FROM ai_conversations c
LEFT JOIN ai_messages m ON c.id = m.conversation_id
WHERE c.status IN ('ai-active', 'staff-taken')
GROUP BY c.id
ORDER BY MAX(m.created_at) DESC;

-- View: Emergency handoff queue
CREATE OR REPLACE VIEW emergency_handoff_queue AS
SELECT 
  hr.id as request_id,
  hr.conversation_id,
  c.session_id,
  hr.priority,
  hr.reason,
  hr.created_at as requested_at,
  COUNT(m.id) as message_count,
  (SELECT content FROM ai_messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at DESC LIMIT 1) as last_user_message
FROM ai_handoff_requests hr
JOIN ai_conversations c ON hr.conversation_id = c.id
LEFT JOIN ai_messages m ON c.id = m.conversation_id
WHERE hr.status = 'pending'
GROUP BY hr.id, c.id
ORDER BY 
  CASE hr.priority
    WHEN 'emergency' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  hr.created_at ASC;

-- ============================================
-- Triggers
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON ai_conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE ai_conversations IS 'Stores AI chatbot conversation sessions';
COMMENT ON TABLE ai_messages IS 'Stores all messages in AI conversations (user, AI, staff, system)';
COMMENT ON TABLE ai_handoff_requests IS 'Tracks requests for staff to take over AI conversations';

COMMENT ON COLUMN ai_conversations.status IS 'ai-active: AI responding | staff-taken: Staff handling | closed: Ended';
COMMENT ON COLUMN ai_messages.role IS 'user: Patient | assistant: AI | staff: Healthcare staff | system: System messages';
COMMENT ON COLUMN ai_handoff_requests.priority IS 'emergency: Immediate | high: Urgent | normal: Standard | low: Non-urgent';
