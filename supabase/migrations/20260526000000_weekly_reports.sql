-- Create Weekly Reports Table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT DEFAULT 'executive-assistant',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  received_count INT DEFAULT 0,
  read_count INT DEFAULT 0,
  unread_count INT DEFAULT 0,
  replied_count INT DEFAULT 0,
  important_emails JSONB DEFAULT '[]'::jsonb,
  need_attention JSONB DEFAULT '[]'::jsonb,
  actions JSONB DEFAULT '[]'::jsonb,
  report_text TEXT NOT NULL
);
