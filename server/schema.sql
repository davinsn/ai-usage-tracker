CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,

    email TEXT UNIQUE NOT NULL,

    department TEXT,

    role TEXT,

    password_hash TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_events (
    id BIGSERIAL PRIMARY KEY,

    employee_id INTEGER
        REFERENCES employees(id)
        ON DELETE SET NULL,

    provider TEXT NOT NULL,

    product TEXT NOT NULL,

    event_type TEXT NOT NULL,

    session_id TEXT,

    interaction_id TEXT UNIQUE,

    model TEXT,

    occurred_at TIMESTAMPTZ NOT NULL,

    latency_ms INTEGER,

    prompt_length INTEGER,

    response_length INTEGER,

    prompt_tokens INTEGER,

    response_tokens INTEGER,

    total_tokens INTEGER,

    metadata JSONB DEFAULT '{}'::jsonb,

    input_cost_usd NUMERIC(18, 12) DEFAULT 0,

    output_cost_usd NUMERIC(18, 12) DEFAULT 0,

    total_cost_usd NUMERIC(18, 12) DEFAULT 0,

    currency TEXT DEFAULT 'USD',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_employee
ON usage_events(employee_id);

CREATE INDEX IF NOT EXISTS idx_usage_provider
ON usage_events(provider);

CREATE INDEX IF NOT EXISTS idx_usage_product
ON usage_events(product);

CREATE INDEX IF NOT EXISTS idx_usage_occurred
ON usage_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_usage_interaction
ON usage_events(interaction_id);