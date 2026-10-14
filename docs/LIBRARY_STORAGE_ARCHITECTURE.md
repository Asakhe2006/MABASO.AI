# Mabaso AI Library storage audit

Audit date: 14 October 2026

## What the repository currently stores

- **My Materials and Study Workspaces:** `study_history_items` stores each authenticated student's generated workspace payload as PostgreSQL JSON. It does not retain a reusable Supabase Storage object key for the original upload.
- **Study Chat and study-source uploads:** the request body is read for extraction and accepted originals can now be retained once in the personal Library. Before the Library retention path, those uploads did not have a durable object reference that another tool could reuse.
- **Collaboration materials:** `collaboration_materials` stores room-scoped metadata and snapshots. Uploaded room images, audio, and video are stored in the `collaboration_media.data_blob` PostgreSQL column and are protected by room-membership checks. They are not personal Library objects and must not be copied into a user's private Library automatically.
- **Conversation history:** the Supabase chat-history integration stores conversation metadata/messages in database tables, not Supabase Storage buckets.

## Buckets visible from source configuration

The repository contains one Supabase Storage bucket setting:

- `SUPABASE_LIBRARY_BUCKET` (example/default: `mabaso-library`) — intended for private, authenticated personal Library originals and explicitly saved file exports.

No pre-existing My Materials, Study Workspace, collaboration, chat-history, or media bucket name is present in the source code. Local `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values are not available in this checkout, so the live Supabase bucket list cannot be enumerated safely from the local environment. The Supabase dashboard remains the authority for any buckets that were created manually outside this repository.

## Is a new bucket necessary?

A durable private object bucket is necessary for **new personal Library originals**, because the existing My Materials and Study Workspace records do not point to retained original binaries. The bucket does not have to be named `mabaso-library`: an existing private bucket can be selected through `SUPABASE_LIBRARY_BUCKET` if its ownership, retention, RLS, MIME, size, and deletion policies are compatible.

Do not create a second physical copy when an eligible existing source already has a stable private bucket/key. In that case, create only a user-owned Library metadata reference to the same object. The current repository has no such pre-existing source-object references to migrate automatically.

## Safest production approach

1. Inspect the live Supabase Storage dashboard and confirm each existing bucket's privacy and lifecycle rules.
2. Reuse a compatible existing **private personal-source bucket** by setting `SUPABASE_LIBRARY_BUCKET` to its exact name, or create `mabaso-library` only when no compatible bucket exists.
3. Keep My Materials, Study Workspaces, collaboration rooms, and Library as separate database concepts.
4. Store each newly retained personal original once; reuse its `library_files.id` across Chat and study tools.
5. Count `library_files.size_bytes` once per committed personal original. Favourites, folders, chat references, and repeated tool use never add storage bytes.
6. Do not automatically import collaboration media. A room member must use an explicit future **Save to My Library** action, which must re-check room permission, personal ownership/copy semantics, and storage capacity.
7. Do not delete any source object while another valid reference still depends on it. Existing Library-owned objects are removed only through authenticated Library deletion.
8. Apply the Library SQL migration so direct Supabase `anon` and `authenticated` table access is revoked; all Library records are resolved through the backend's authenticated owner checks.

## Files that belong in the Library bucket

- New accepted personal source PDFs, Word files, spreadsheets, presentations, images, text files, and supported audio recordings.
- Explicitly saved exports such as a Study Guide PDF.
- Private preview artifacts only when needed, with the same ownership and cleanup policy.

The bucket must not automatically contain whole interactive Study Workspaces, room-private files owned by another participant, original video binaries, temporary processing files, or saved-link webpage copies.
