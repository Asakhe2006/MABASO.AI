-- Personal Library metadata and concurrency-safe storage accounting.
-- File binaries belong in a private Supabase Storage bucket, never PostgreSQL.

CREATE TABLE IF NOT EXISTS library_storage_accounts (
    owner_email TEXT PRIMARY KEY,
    committed_bytes BIGINT NOT NULL DEFAULT 0 CHECK (committed_bytes >= 0),
    reserved_bytes BIGINT NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS library_files (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum_sha256 TEXT NOT NULL,
    category TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'upload',
    extracted_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_library_files_owner_created
    ON library_files (owner_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_files_owner_checksum
    ON library_files (owner_email, checksum_sha256, deleted_at);

CREATE TABLE IF NOT EXISTS library_storage_reservations (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_reservations_owner_expires
    ON library_storage_reservations (owner_email, expires_at);

ALTER TABLE collaboration_profiles
    ADD COLUMN IF NOT EXISTS ai_personalization_enabled INTEGER NOT NULL DEFAULT 0;
