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
    folder_id TEXT NOT NULL DEFAULT '',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_library_files_owner_created
    ON library_files (owner_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_files_owner_checksum
    ON library_files (owner_email, checksum_sha256, deleted_at);

CREATE INDEX IF NOT EXISTS idx_library_files_owner_folder
    ON library_files (owner_email, folder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_files_owner_favorite
    ON library_files (owner_email, is_favorite, created_at DESC);

CREATE TABLE IF NOT EXISTS library_folders (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    name TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_folders_owner_name
    ON library_folders (owner_email, name, deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_folders_owner_name_ci
    ON library_folders (lower(owner_email), lower(name), deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_folders_owner_name_ci
    ON library_folders (lower(owner_email), lower(name), deleted_at);

CREATE TABLE IF NOT EXISTS library_links (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'manual',
    folder_id TEXT NOT NULL DEFAULT '',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_links_owner_url
    ON library_links (owner_email, normalized_url, deleted_at);

CREATE INDEX IF NOT EXISTS idx_library_links_owner_created
    ON library_links (owner_email, created_at DESC);

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

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS library_auto_save_links INTEGER NOT NULL DEFAULT 0;

-- These records are intentionally served only through Mabaso AI's authenticated
-- backend ownership checks. Supabase browser roles receive no direct table access.
ALTER TABLE library_storage_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_storage_reservations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE library_storage_accounts, library_files, library_folders,
            library_links, library_storage_reservations FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE library_storage_accounts, library_files, library_folders,
            library_links, library_storage_reservations FROM authenticated;
    END IF;
END $$;

-- These records are intentionally served only through Mabaso AI's authenticated
-- backend ownership checks. Supabase browser roles receive no direct table access.
ALTER TABLE library_storage_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_storage_reservations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE library_storage_accounts, library_files, library_folders,
            library_links, library_storage_reservations FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE library_storage_accounts, library_files, library_folders,
            library_links, library_storage_reservations FROM authenticated;
    END IF;
END $$;
