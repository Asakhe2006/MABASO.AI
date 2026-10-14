-- Organisational metadata for the personal Library. Files remain in the
-- existing private object bucket; these rows never duplicate file bytes.

ALTER TABLE library_files ADD COLUMN IF NOT EXISTS folder_id TEXT NOT NULL DEFAULT '';
ALTER TABLE library_files ADD COLUMN IF NOT EXISTS is_favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS library_auto_save_links INTEGER NOT NULL DEFAULT 0;

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
CREATE INDEX IF NOT EXISTS idx_library_files_owner_folder
    ON library_files (owner_email, folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_files_owner_favorite
    ON library_files (owner_email, is_favorite, created_at DESC);

ALTER TABLE library_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE library_files, library_folders, library_links FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE library_files, library_folders, library_links FROM authenticated;
    END IF;
END $$;

ALTER TABLE library_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE library_files, library_folders, library_links FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE library_files, library_folders, library_links FROM authenticated;
    END IF;
END $$;
