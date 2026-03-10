-- Add public doctor demo access request queue
-- Run against medicore master database

CREATE TABLE IF NOT EXISTS demo_access_requests (
    id varchar(36) PRIMARY KEY,
    full_name varchar(160) NOT NULL,
    clinic_name varchar(160) NOT NULL,
    work_email varchar(160) NOT NULL,
    phone varchar(50) NOT NULL,
    role_title varchar(120),
    specialization varchar(120),
    current_system varchar(160),
    interest_summary text NOT NULL,
    interest_areas text NOT NULL DEFAULT '[]',
    preferred_contact_method varchar(32) NOT NULL DEFAULT 'email',
    status varchar(32) NOT NULL DEFAULT 'new',
    admin_notes text,
    assigned_tenant_id varchar(36),
    assigned_subdomain varchar(120),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_access_requests_status_created
  ON demo_access_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_access_requests_work_email
  ON demo_access_requests(work_email);
