-- Create schema for 3CX-NinjaOne integration
CREATE SCHEMA IF NOT EXISTS integration;

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE integration.call_status AS ENUM (
    'RECEIVED',
    'DOWNLOADING',
    'DOWNLOADED',
    'TRANSCRIBING',
    'TRANSCRIBED',
    'DRAFT_CREATED',
    'TICKET_CREATED',
    'FAILED',
    'EXPIRED'
);

CREATE TYPE integration.ticket_status AS ENUM (
    'DRAFT',
    'PENDING_CONFIRMATION',
    'CONFIRMED',
    'CANCELLED',
    'CREATED',
    'FAILED'
);

-- Calls table
CREATE TABLE integration.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id VARCHAR(255) UNIQUE NOT NULL,
    extension VARCHAR(50) NOT NULL,
    agent_name VARCHAR(255),
    caller_number VARCHAR(50),
    caller_name VARCHAR(255),
    duration INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    recording_url TEXT,
    local_recording_path TEXT,
    transcript TEXT,
    status integration.call_status DEFAULT 'RECEIVED',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Draft tickets table
CREATE TABLE integration.draft_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES integration.calls(id) ON DELETE CASCADE,
    draft_data JSONB NOT NULL,
    agent_extension VARCHAR(50) NOT NULL,
    status integration.ticket_status DEFAULT 'DRAFT',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Created tickets table
CREATE TABLE integration.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draft_id UUID REFERENCES integration.draft_tickets(id),
    call_id UUID REFERENCES integration.calls(id),
    ninjaone_ticket_id VARCHAR(255) UNIQUE,
    ninjaone_ticket_number VARCHAR(100),
    ticket_data JSONB NOT NULL,
    created_by_extension VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent sessions table
CREATE TABLE integration.agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extension VARCHAR(50) NOT NULL,
    agent_name VARCHAR(255),
    jwt_token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- WebSocket connections tracking
CREATE TABLE integration.active_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_type VARCHAR(50) NOT NULL, -- 'agent' or 'tv'
    extension VARCHAR(50),
    connection_id VARCHAR(255) UNIQUE NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE integration.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    actor_extension VARCHAR(50),
    actor_ip INET,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_calls_status ON integration.calls(status);
CREATE INDEX idx_calls_extension ON integration.calls(extension);
CREATE INDEX idx_calls_created_at ON integration.calls(created_at);
CREATE INDEX idx_draft_tickets_status ON integration.draft_tickets(status);
CREATE INDEX idx_draft_tickets_expires_at ON integration.draft_tickets(expires_at);
CREATE INDEX idx_tickets_ninjaone_id ON integration.tickets(ninjaone_ticket_id);
CREATE INDEX idx_agent_sessions_extension ON integration.agent_sessions(extension);
CREATE INDEX idx_active_connections_type ON integration.active_connections(connection_type);
CREATE INDEX idx_audit_log_created_at ON integration.audit_log(created_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION integration.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON integration.calls
    FOR EACH ROW EXECUTE FUNCTION integration.update_updated_at_column();

CREATE TRIGGER update_draft_tickets_updated_at BEFORE UPDATE ON integration.draft_tickets
    FOR EACH ROW EXECUTE FUNCTION integration.update_updated_at_column();

-- Function to clean expired drafts
CREATE OR REPLACE FUNCTION integration.clean_expired_drafts()
RETURNS void AS $$
BEGIN
    UPDATE integration.draft_tickets
    SET status = 'EXPIRED'
    WHERE status = 'PENDING_CONFIRMATION'
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old audio files references
CREATE OR REPLACE FUNCTION integration.get_old_audio_files(retention_days INTEGER)
RETURNS TABLE(file_path TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT local_recording_path
    FROM integration.calls
    WHERE created_at < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL
    AND local_recording_path IS NOT NULL;
END;
$$ LANGUAGE plpgsql;