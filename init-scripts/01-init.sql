-- PostgreSQL initialization script for AMS Agentic Company
-- This script runs when the PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agent_recordings table
CREATE TABLE IF NOT EXISTS agent_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sequence JSONB NOT NULL, -- JSON array of objects for the recorded sequence
    next_sequence_id INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create scheduled_recordings table
CREATE TABLE IF NOT EXISTS scheduled_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code TEXT NOT NULL, -- Cron expression or scheduling code
    sequenceId UUID REFERENCES agent_recordings(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create ai_modes table
CREATE TABLE IF NOT EXISTS ai_modes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ai_name VARCHAR(255) DEFAULT 'Silma AI',
    system_message TEXT,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    top_p DECIMAL(3,2) DEFAULT 0.8,
    top_k INTEGER DEFAULT 40,
    icon VARCHAR(255),
    department VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_recordings_name ON agent_recordings(name);
CREATE INDEX IF NOT EXISTS idx_agent_recordings_created_at ON agent_recordings(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_recordings_deleted_at ON agent_recordings(deleted_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_recordings_name ON scheduled_recordings(name);
CREATE INDEX IF NOT EXISTS idx_scheduled_recordings_code ON scheduled_recordings(code);
CREATE INDEX IF NOT EXISTS idx_scheduled_recordings_sequenceId ON scheduled_recordings(sequenceId);
CREATE INDEX IF NOT EXISTS idx_scheduled_recordings_created_at ON scheduled_recordings(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_recordings_deleted_at ON scheduled_recordings(deleted_at);

CREATE INDEX IF NOT EXISTS idx_ai_modes_name ON ai_modes(name);
CREATE INDEX IF NOT EXISTS idx_ai_modes_department ON ai_modes(department);
CREATE INDEX IF NOT EXISTS idx_ai_modes_is_active ON ai_modes(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_modes_created_at ON ai_modes(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_modes_deleted_at ON ai_modes(deleted_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_agent_recordings_updated_at BEFORE UPDATE ON agent_recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_recordings_updated_at BEFORE UPDATE ON scheduled_recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_modes_updated_at BEFORE UPDATE ON ai_modes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL database initialized successfully for AMS Agentic Company with agent_recordings table';
END $$;
