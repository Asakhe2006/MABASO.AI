"""Authenticated organisational routes for the Mabaso AI personal Library."""

from __future__ import annotations

import asyncio
from io import BytesIO
import json
from typing import Any, Callable
from uuid import uuid4
import zipfile

from fastapi import Depends, HTTPException, Query, Request
from fastapi.responses import Response

from library_catalog import (
    LibraryBulkUpdate,
    LibraryDeleteAllRequest,
    LibraryFileUpdate,
    LibraryFolderCreate,
    LibraryFolderUpdate,
    LibraryLinkCreate,
    LibraryLinkImport,
    LibraryLinkUpdate,
    LibraryPreferenceUpdate,
    clean_folder_name,
    normalize_saved_link,
    normalize_library_settings,
    serialize_folder,
    serialize_link,
)


def register_library_routes(
    app: Any,
    *,
    require_authenticated_user: Callable[..., str],
    get_db_connection: Callable[..., Any],
    normalize_email: Callable[[str], str],
    compact_text: Callable[..., str],
    utc_now: Callable[..., Any],
    get_library_storage_summary: Callable[[str], dict[str, Any]],
    serialize_library_file: Callable[[Any], dict[str, Any]],
    get_owned_library_file: Callable[[str, str], Any],
    record_audit_log: Callable[..., Any],
    library_object_storage: Any,
    library_storage_error: type[Exception],
    enforce_rate_limit: Callable[..., Any],
) -> None:
    def read_settings(email: str) -> dict[str, Any]:
        with get_db_connection() as connection:
            row = connection.execute(
                "SELECT library_settings_json, library_auto_save_links FROM users WHERE lower(email) = ? LIMIT 1",
                (normalize_email(email),),
            ).fetchone()
        raw: dict[str, Any] = {}
        if row:
            try:
                raw = json.loads(row["library_settings_json"] or "{}")
            except (json.JSONDecodeError, TypeError):
                raw = {}
            raw["auto_save_links"] = bool(int(row["library_auto_save_links"] or 0))
        return normalize_library_settings(raw)

    def owned_folder_ids(connection: Any, email: str, folder_ids: list[str]) -> list[str]:
        verified: list[str] = []
        for folder_id in list(dict.fromkeys(compact_text(item) for item in folder_ids if compact_text(item)))[:100]:
            if owned_folder(connection, email, folder_id):
                verified.append(folder_id)
        return verified

    def owned_folder(connection: Any, email: str, folder_id: str) -> Any:
        if not compact_text(folder_id):
            return None
        return connection.execute(
            "SELECT * FROM library_folders WHERE id = ? AND lower(owner_email) = ? AND deleted_at = '' LIMIT 1",
            (compact_text(folder_id), normalize_email(email)),
        ).fetchone()

    def ensure_folder(connection: Any, email: str, folder_id: str) -> str:
        normalized = compact_text(folder_id)
        if normalized and not owned_folder(connection, email, normalized):
            raise HTTPException(status_code=404, detail="Library folder not found.")
        return normalized

    def get_owned_link(email: str, link_id: str) -> Any:
        with get_db_connection() as connection:
            return connection.execute(
                "SELECT * FROM library_links WHERE id = ? AND lower(owner_email) = ? AND deleted_at = '' LIMIT 1",
                (compact_text(link_id), normalize_email(email)),
            ).fetchone()

    def save_link(email: str, payload: LibraryLinkCreate) -> tuple[dict[str, Any], bool]:
        normalized_email = normalize_email(email)
        try:
            normalized_url, domain = normalize_saved_link(payload.url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        now_iso = utc_now().isoformat()
        with get_db_connection() as connection:
            folder_id = ensure_folder(connection, normalized_email, payload.folder_id)
            existing = connection.execute(
                "SELECT * FROM library_links WHERE lower(owner_email) = ? AND normalized_url = ? AND deleted_at = '' LIMIT 1",
                (normalized_email, normalized_url),
            ).fetchone()
            if existing:
                connection.execute(
                    "UPDATE library_links SET title = CASE WHEN ? <> '' THEN ? ELSE title END, "
                    "description = CASE WHEN ? <> '' THEN ? ELSE description END, folder_id = CASE WHEN ? <> '' THEN ? ELSE folder_id END, "
                    "updated_at = ? WHERE id = ? AND lower(owner_email) = ?",
                    (
                        compact_text(payload.title), compact_text(payload.title)[:240],
                        compact_text(payload.description), compact_text(payload.description)[:500],
                        folder_id, folder_id, now_iso, existing["id"], normalized_email,
                    ),
                )
                row = connection.execute("SELECT * FROM library_links WHERE id = ?", (existing["id"],)).fetchone()
                return serialize_link(row), True
            link_id = uuid4().hex
            connection.execute(
                "INSERT INTO library_links (id, owner_email, url, normalized_url, title, description, domain, source_type, "
                "folder_id, is_favorite, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, '')",
                (
                    link_id, normalized_email, normalized_url, normalized_url,
                    compact_text(payload.title, domain)[:240], compact_text(payload.description)[:500], domain,
                    compact_text(payload.source_type, "manual")[:40], folder_id, now_iso, now_iso,
                ),
            )
            row = connection.execute("SELECT * FROM library_links WHERE id = ?", (link_id,)).fetchone()
        return serialize_link(row), False

    @app.get("/api/library/catalog")
    async def get_library_catalog(
        section: str = Query(default="all", max_length=30),
        search: str = Query(default="", max_length=120),
        folder_id: str = Query(default="", max_length=80),
        before: str = Query(default="", max_length=80),
        limit: int = Query(default=30, ge=1, le=60),
        sort: str = Query(default="", max_length=30),
        current_user: str = Depends(require_authenticated_user),
    ):
        normalized_email = normalize_email(current_user)
        settings = await asyncio.to_thread(read_settings, normalized_email)
        normalized_section = compact_text(section, "all").lower()
        where = ["lower(owner_email) = ?", "deleted_at = ''"]
        params: list[Any] = [normalized_email]
        if compact_text(search):
            pattern = f"%{compact_text(search).lower()}%"
            if settings["search_file_contents"]:
                where.append("(lower(original_name) LIKE ? OR lower(extracted_text) LIKE ?)")
                params.extend([pattern, pattern])
            else:
                where.append("lower(original_name) LIKE ?")
                params.append(pattern)
        if compact_text(folder_id):
            where.append("folder_id = ?")
            params.append(compact_text(folder_id))
        if normalized_section == "favorites":
            where.append("is_favorite = 1")
        elif normalized_section == "images":
            where.append("category = 'image'")
        elif normalized_section == "recordings":
            where.append("category = 'audio'")
        elif normalized_section == "transcripts":
            where.append("(lower(source_type) LIKE '%transcript%' OR lower(original_name) LIKE '%transcript%')")
        cursor = compact_text(before)
        if cursor:
            cursor_created_at, separator, cursor_id = cursor.partition("|")
            if separator and cursor_created_at and cursor_id:
                where.append("(created_at < ? OR (created_at = ? AND id < ?))")
                params.extend([cursor_created_at, cursor_created_at, cursor_id])
            else:
                where.append("created_at < ?")
                params.append(cursor)
        params.append(limit + 1)
        normalized_sort = compact_text(sort, settings["default_sort"]).lower()
        order_by = {
            "oldest": "created_at ASC, id ASC",
            "name_asc": "lower(original_name) ASC, id ASC",
            "name_desc": "lower(original_name) DESC, id DESC",
            "largest": "size_bytes DESC, id DESC",
            "smallest": "size_bytes ASC, id ASC",
        }.get(normalized_sort, "created_at DESC, id DESC")
        with get_db_connection() as connection:
            file_rows = connection.execute(
                f"SELECT * FROM library_files WHERE {' AND '.join(where)} ORDER BY {order_by} LIMIT ?",
                tuple(params),
            ).fetchall()
            folder_rows = connection.execute(
                "SELECT f.*, (SELECT COUNT(*) FROM library_files lf WHERE lf.folder_id = f.id AND lower(lf.owner_email) = lower(f.owner_email) AND lf.deleted_at = '') + "
                "(SELECT COUNT(*) FROM library_links ll WHERE ll.folder_id = f.id AND lower(ll.owner_email) = lower(f.owner_email) AND ll.deleted_at = '') AS item_count "
                "FROM library_folders f WHERE lower(f.owner_email) = ? AND f.deleted_at = '' ORDER BY lower(f.name), f.id",
                (normalized_email,),
            ).fetchall()
            link_where = ["lower(owner_email) = ?", "deleted_at = ''"]
            link_params: list[Any] = [normalized_email]
            if compact_text(search):
                link_where.append("(lower(title) LIKE ? OR lower(domain) LIKE ? OR lower(url) LIKE ?)")
                pattern = f"%{compact_text(search).lower()}%"
                link_params.extend([pattern, pattern, pattern])
            if compact_text(folder_id):
                link_where.append("folder_id = ?")
                link_params.append(compact_text(folder_id))
            if normalized_section == "favorites":
                link_where.append("is_favorite = 1")
            link_rows = []
            if normalized_section in {"links", "favorites", "all"}:
                link_params.append(limit)
                link_rows = connection.execute(
                    f"SELECT * FROM library_links WHERE {' AND '.join(link_where)} ORDER BY created_at DESC, id DESC LIMIT ?",
                    tuple(link_params),
                ).fetchall()
        has_more = len(file_rows) > limit
        page = file_rows[:limit]
        return {
            "files": [serialize_library_file(row) for row in page],
            "folders": [serialize_folder(row) for row in folder_rows],
            "links": [serialize_link(row) for row in link_rows],
            "next_before": f"{compact_text(page[-1]['created_at'])}|{compact_text(page[-1]['id'])}" if has_more and page else "",
            "has_more": has_more,
            "storage": await asyncio.to_thread(get_library_storage_summary, normalized_email),
            "preferences": settings,
        }

    @app.get("/api/library/overview")
    async def get_library_overview(
        limit: int = Query(default=5, ge=1, le=10),
        current_user: str = Depends(require_authenticated_user),
    ):
        email = normalize_email(current_user)
        with get_db_connection() as connection:
            recent = connection.execute(
                "SELECT * FROM library_files WHERE lower(owner_email) = ? AND deleted_at = '' ORDER BY created_at DESC LIMIT ?",
                (email, limit),
            ).fetchall()
            favorite_files = connection.execute(
                "SELECT * FROM library_files WHERE lower(owner_email) = ? AND deleted_at = '' AND is_favorite = 1 ORDER BY updated_at DESC LIMIT ?",
                (email, limit),
            ).fetchall()
            favorite_folders = connection.execute(
                "SELECT f.*, (SELECT COUNT(*) FROM library_files lf WHERE lf.folder_id = f.id AND lower(lf.owner_email) = lower(f.owner_email) AND lf.deleted_at = '') + "
                "(SELECT COUNT(*) FROM library_links ll WHERE ll.folder_id = f.id AND lower(ll.owner_email) = lower(f.owner_email) AND ll.deleted_at = '') AS item_count "
                "FROM library_folders f WHERE lower(f.owner_email) = ? AND f.deleted_at = '' AND f.is_favorite = 1 ORDER BY f.updated_at DESC LIMIT ?",
                (email, limit),
            ).fetchall()
            favorite_links = connection.execute(
                "SELECT * FROM library_links WHERE lower(owner_email) = ? AND deleted_at = '' AND is_favorite = 1 ORDER BY updated_at DESC LIMIT ?",
                (email, limit),
            ).fetchall()
            folders = connection.execute(
                "SELECT f.*, (SELECT COUNT(*) FROM library_files lf WHERE lf.folder_id = f.id AND lower(lf.owner_email) = lower(f.owner_email) AND lf.deleted_at = '') + "
                "(SELECT COUNT(*) FROM library_links ll WHERE ll.folder_id = f.id AND lower(ll.owner_email) = lower(f.owner_email) AND ll.deleted_at = '') AS item_count "
                "FROM library_folders f WHERE lower(f.owner_email) = ? AND f.deleted_at = '' ORDER BY f.updated_at DESC LIMIT ?",
                (email, limit),
            ).fetchall()
            images = connection.execute(
                "SELECT * FROM library_files WHERE lower(owner_email) = ? AND deleted_at = '' AND category = 'image' ORDER BY created_at DESC LIMIT ?",
                (email, limit),
            ).fetchall()
            links = connection.execute(
                "SELECT * FROM library_links WHERE lower(owner_email) = ? AND deleted_at = '' ORDER BY created_at DESC LIMIT ?",
                (email, limit),
            ).fetchall()
        favorites = (
            [serialize_library_file(row) for row in favorite_files]
            + [{**serialize_folder(row), "item_type": "folder"} for row in favorite_folders]
            + [serialize_link(row) for row in favorite_links]
        )
        favorites.sort(key=lambda item: compact_text(item.get("updated_at")), reverse=True)
        return {
            "recent": [serialize_library_file(row) for row in recent],
            "favorites": favorites[:limit],
            "folders": [serialize_folder(row) for row in folders],
            "images": [serialize_library_file(row) for row in images],
            "links": [serialize_link(row) for row in links],
        }

    @app.post("/api/library/folders")
    async def create_library_folder(
        payload: LibraryFolderCreate,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        enforce_rate_limit(scope="library_folder_write", request=request, limit=120, window_seconds=3600, identity=current_user)
        try:
            name = clean_folder_name(payload.name)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        email = normalize_email(current_user)
        now_iso = utc_now().isoformat()
        with get_db_connection() as connection:
            duplicate = connection.execute(
                "SELECT id FROM library_folders WHERE lower(owner_email) = ? AND lower(name) = ? AND deleted_at = '' LIMIT 1",
                (email, name.lower()),
            ).fetchone()
            if duplicate:
                raise HTTPException(status_code=409, detail="A Library folder with this name already exists.")
            folder_id = uuid4().hex
            connection.execute(
                "INSERT INTO library_folders (id, owner_email, name, is_favorite, created_at, updated_at, deleted_at) VALUES (?, ?, ?, 0, ?, ?, '')",
                (folder_id, email, name, now_iso, now_iso),
            )
            row = connection.execute("SELECT *, 0 AS item_count FROM library_folders WHERE id = ?", (folder_id,)).fetchone()
        record_audit_log(action="library.folder.created", email=email, request=request, resource_type="library_folder", resource_name=folder_id)
        return {"folder": serialize_folder(row)}

    @app.patch("/api/library/folders/{folder_id}")
    async def update_library_folder(
        folder_id: str,
        payload: LibraryFolderUpdate,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        email = normalize_email(current_user)
        with get_db_connection() as connection:
            row = owned_folder(connection, email, folder_id)
            if not row:
                raise HTTPException(status_code=404, detail="Library folder not found.")
            name = row["name"]
            if payload.name is not None:
                try:
                    name = clean_folder_name(payload.name)
                except ValueError as exc:
                    raise HTTPException(status_code=422, detail=str(exc)) from exc
            favorite = int(payload.is_favorite) if payload.is_favorite is not None else int(row["is_favorite"] or 0)
            connection.execute(
                "UPDATE library_folders SET name = ?, is_favorite = ?, updated_at = ? WHERE id = ? AND lower(owner_email) = ?",
                (name, favorite, utc_now().isoformat(), folder_id, email),
            )
            updated = connection.execute("SELECT *, 0 AS item_count FROM library_folders WHERE id = ?", (folder_id,)).fetchone()
        record_audit_log(action="library.folder.updated", email=email, request=request, resource_type="library_folder", resource_name=folder_id)
        return {"folder": serialize_folder(updated)}

    @app.delete("/api/library/folders/{folder_id}")
    async def delete_library_folder(
        folder_id: str,
        request: Request,
        delete_contents: bool = Query(default=False),
        current_user: str = Depends(require_authenticated_user),
    ):
        email = normalize_email(current_user)
        with get_db_connection() as connection:
            folder = owned_folder(connection, email, folder_id)
            if not folder:
                raise HTTPException(status_code=404, detail="Library folder not found.")
            file_rows = connection.execute(
                "SELECT * FROM library_files WHERE folder_id = ? AND lower(owner_email) = ? AND deleted_at = ''", (folder_id, email)
            ).fetchall()
        now_iso = utc_now().isoformat()
        with get_db_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            if delete_contents:
                deleted_bytes = sum(int(row["size_bytes"] or 0) for row in file_rows)
                connection.execute("UPDATE library_files SET deleted_at = ?, status = 'deleted', updated_at = ? WHERE folder_id = ? AND lower(owner_email) = ? AND deleted_at = ''", (now_iso, now_iso, folder_id, email))
                connection.execute("UPDATE library_links SET deleted_at = ?, updated_at = ? WHERE folder_id = ? AND lower(owner_email) = ? AND deleted_at = ''", (now_iso, now_iso, folder_id, email))
                connection.execute("UPDATE library_storage_accounts SET committed_bytes = CASE WHEN committed_bytes >= ? THEN committed_bytes - ? ELSE 0 END, updated_at = ? WHERE lower(owner_email) = ?", (deleted_bytes, deleted_bytes, now_iso, email))
            else:
                connection.execute("UPDATE library_files SET folder_id = '', updated_at = ? WHERE folder_id = ? AND lower(owner_email) = ? AND deleted_at = ''", (now_iso, folder_id, email))
                connection.execute("UPDATE library_links SET folder_id = '', updated_at = ? WHERE folder_id = ? AND lower(owner_email) = ? AND deleted_at = ''", (now_iso, folder_id, email))
            connection.execute("UPDATE library_folders SET deleted_at = ?, updated_at = ? WHERE id = ? AND lower(owner_email) = ?", (now_iso, now_iso, folder_id, email))
        record_audit_log(action="library.folder.deleted", email=email, request=request, resource_type="library_folder", resource_name=folder_id, metadata={"delete_contents": delete_contents})
        return {"deleted": True, "contents_deleted": delete_contents, "storage": await asyncio.to_thread(get_library_storage_summary, email)}

    @app.patch("/api/library/files/{file_id}")
    async def update_library_file(
        file_id: str,
        payload: LibraryFileUpdate,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        email = normalize_email(current_user)
        with get_db_connection() as connection:
            row = connection.execute("SELECT * FROM library_files WHERE id = ? AND lower(owner_email) = ? AND deleted_at = '' LIMIT 1", (compact_text(file_id), email)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Library file not found.")
            folder_id = ensure_folder(connection, email, payload.folder_id) if payload.folder_id is not None else compact_text(row["folder_id"])
            favorite = int(payload.is_favorite) if payload.is_favorite is not None else int(row["is_favorite"] or 0)
            name = compact_text(payload.name, row["original_name"])[:180] if payload.name is not None else row["original_name"]
            if not name:
                raise HTTPException(status_code=422, detail="Enter a file name.")
            connection.execute("UPDATE library_files SET original_name = ?, folder_id = ?, is_favorite = ?, updated_at = ? WHERE id = ? AND lower(owner_email) = ?", (name, folder_id, favorite, utc_now().isoformat(), file_id, email))
            updated = connection.execute("SELECT * FROM library_files WHERE id = ?", (file_id,)).fetchone()
        record_audit_log(action="library.file.organized", email=email, request=request, resource_type="library_file", resource_name=file_id)
        return {"file": serialize_library_file(updated)}

    @app.post("/api/library/files/bulk")
    async def bulk_update_library_files(
        payload: LibraryBulkUpdate,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        file_ids = list(dict.fromkeys(compact_text(item) for item in payload.file_ids if compact_text(item)))[:60]
        if not file_ids:
            raise HTTPException(status_code=422, detail="Select at least one Library file.")
        email = normalize_email(current_user)
        updated_files = []
        with get_db_connection() as connection:
            folder_id = ensure_folder(connection, email, payload.folder_id) if payload.folder_id is not None else None
            for file_id in file_ids:
                row = connection.execute("SELECT * FROM library_files WHERE id = ? AND lower(owner_email) = ? AND deleted_at = '' LIMIT 1", (file_id, email)).fetchone()
                if not row:
                    continue
                next_folder = folder_id if folder_id is not None else compact_text(row["folder_id"])
                next_favorite = int(payload.is_favorite) if payload.is_favorite is not None else int(row["is_favorite"] or 0)
                connection.execute("UPDATE library_files SET folder_id = ?, is_favorite = ?, updated_at = ? WHERE id = ? AND lower(owner_email) = ?", (next_folder, next_favorite, utc_now().isoformat(), file_id, email))
                updated_files.append(file_id)
        record_audit_log(action="library.files.bulk_organized", email=email, request=request, resource_type="library_file", metadata={"count": len(updated_files)})
        return {"updated": updated_files}

    @app.post("/api/library/links")
    async def create_library_link(
        payload: LibraryLinkCreate,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        enforce_rate_limit(scope="library_link_write", request=request, limit=120, window_seconds=3600, identity=current_user)
        link, existing = await asyncio.to_thread(save_link, current_user, payload)
        record_audit_log(action="library.link.saved", email=current_user, request=request, resource_type="library_link", resource_name=link["id"], metadata={"deduplicated": existing, "domain": link["domain"]})
        return {"link": link, "deduplicated": existing}

    @app.post("/api/library/links/import")
    async def import_library_links(
        payload: LibraryLinkImport,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        enforce_rate_limit(scope="library_link_import", request=request, limit=60, window_seconds=3600, identity=current_user)
        saved, rejected = [], []
        for item in payload.links[:20]:
            try:
                link, _ = await asyncio.to_thread(save_link, current_user, item)
                saved.append(link)
            except HTTPException as exc:
                rejected.append({"url": item.url[:160], "detail": exc.detail})
        return {"saved": saved, "rejected": rejected}

    @app.patch("/api/library/links/{link_id}")
    async def update_library_link(
        link_id: str,
        payload: LibraryLinkUpdate,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        email = normalize_email(current_user)
        with get_db_connection() as connection:
            row = connection.execute("SELECT * FROM library_links WHERE id = ? AND lower(owner_email) = ? AND deleted_at = '' LIMIT 1", (compact_text(link_id), email)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Saved link not found.")
            folder_id = ensure_folder(connection, email, payload.folder_id) if payload.folder_id is not None else compact_text(row["folder_id"])
            title = compact_text(payload.title, row["title"])[:240] if payload.title is not None else row["title"]
            description = compact_text(payload.description)[:500] if payload.description is not None else row["description"]
            favorite = int(payload.is_favorite) if payload.is_favorite is not None else int(row["is_favorite"] or 0)
            connection.execute("UPDATE library_links SET title = ?, description = ?, folder_id = ?, is_favorite = ?, updated_at = ? WHERE id = ? AND lower(owner_email) = ?", (title, description, folder_id, favorite, utc_now().isoformat(), link_id, email))
            updated = connection.execute("SELECT * FROM library_links WHERE id = ?", (link_id,)).fetchone()
        record_audit_log(action="library.link.updated", email=email, request=request, resource_type="library_link", resource_name=link_id)
        return {"link": serialize_link(updated)}

    @app.delete("/api/library/links/{link_id}")
    async def delete_library_link(
        link_id: str,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        email = normalize_email(current_user)
        row = await asyncio.to_thread(get_owned_link, email, link_id)
        if not row:
            raise HTTPException(status_code=404, detail="Saved link not found.")
        now_iso = utc_now().isoformat()
        with get_db_connection() as connection:
            connection.execute("UPDATE library_links SET deleted_at = ?, updated_at = ? WHERE id = ? AND lower(owner_email) = ?", (now_iso, now_iso, link_id, email))
        record_audit_log(action="library.link.deleted", email=email, request=request, resource_type="library_link", resource_name=link_id)
        return {"deleted": True}

    @app.get("/api/library/preferences")
    async def get_library_preferences(current_user: str = Depends(require_authenticated_user)):
        return await asyncio.to_thread(read_settings, current_user)

    @app.patch("/api/library/preferences")
    async def update_library_preferences(
        payload: LibraryPreferenceUpdate,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        email = normalize_email(current_user)
        updates = payload.model_dump(exclude_unset=True)
        with get_db_connection() as connection:
            current = read_settings(email)
            if "selected_folder_ids" in updates:
                updates["selected_folder_ids"] = owned_folder_ids(connection, email, updates["selected_folder_ids"] or [])
            if "excluded_folder_ids" in updates:
                updates["excluded_folder_ids"] = owned_folder_ids(connection, email, updates["excluded_folder_ids"] or [])
            next_settings = normalize_library_settings({**current, **updates})
            connection.execute(
                "UPDATE users SET library_settings_json = ?, library_auto_save_links = ?, updated_at = ? WHERE lower(email) = ?",
                (json.dumps(next_settings, separators=(",", ":")), int(next_settings["auto_save_links"]), utc_now().isoformat(), email),
            )
        record_audit_log(action="library.preferences.updated", email=email, request=request, resource_type="library_preferences", metadata={"changed": sorted(updates)})
        return next_settings

    @app.get("/api/library/recently-deleted")
    async def list_recently_deleted(current_user: str = Depends(require_authenticated_user)):
        email = normalize_email(current_user)
        with get_db_connection() as connection:
            rows = connection.execute(
                "SELECT * FROM library_files WHERE lower(owner_email) = ? AND deleted_at <> '' ORDER BY deleted_at DESC LIMIT 100",
                (email,),
            ).fetchall()
        return {"files": [{**serialize_library_file(row), "deleted_at": compact_text(row["deleted_at"])} for row in rows]}

    @app.post("/api/library/recently-deleted/{file_id}/restore")
    async def restore_deleted_library_file(
        file_id: str,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        email = normalize_email(current_user)
        with get_db_connection() as connection:
            row = connection.execute(
                "SELECT * FROM library_files WHERE id = ? AND lower(owner_email) = ? AND deleted_at <> '' LIMIT 1",
                (compact_text(file_id), email),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Deleted Library file not found.")
        storage = await asyncio.to_thread(get_library_storage_summary, email)
        size_bytes = int(row["size_bytes"] or 0)
        if size_bytes > int(storage.get("remaining_bytes") or 0):
            raise HTTPException(status_code=409, detail="There is not enough Library storage to restore this file.")
        now_iso = utc_now().isoformat()
        with get_db_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "UPDATE library_files SET deleted_at = '', status = 'ready', folder_id = CASE WHEN EXISTS (SELECT 1 FROM library_folders WHERE id = library_files.folder_id AND lower(owner_email) = ? AND deleted_at = '') THEN folder_id ELSE '' END, updated_at = ? WHERE id = ? AND lower(owner_email) = ? AND deleted_at <> ''",
                (email, now_iso, file_id, email),
            )
            connection.execute(
                "INSERT INTO library_storage_accounts (owner_email, committed_bytes, reserved_bytes, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(owner_email) DO UPDATE SET committed_bytes = library_storage_accounts.committed_bytes + excluded.committed_bytes, updated_at = excluded.updated_at",
                (email, size_bytes, now_iso),
            )
            restored = connection.execute("SELECT * FROM library_files WHERE id = ? AND lower(owner_email) = ?", (file_id, email)).fetchone()
        record_audit_log(action="library.file.restored", email=email, request=request, resource_type="library_file", resource_name=file_id)
        return {"file": serialize_library_file(restored), "storage": await asyncio.to_thread(get_library_storage_summary, email)}

    @app.delete("/api/library/recently-deleted/{file_id}")
    async def permanently_delete_library_file(
        file_id: str,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        email = normalize_email(current_user)
        with get_db_connection() as connection:
            row = connection.execute(
                "SELECT * FROM library_files WHERE id = ? AND lower(owner_email) = ? AND deleted_at <> '' LIMIT 1",
                (compact_text(file_id), email),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Deleted Library file not found.")
        try:
            await asyncio.to_thread(library_object_storage.delete, [compact_text(row["object_key"])])
        except library_storage_error as exc:
            raise HTTPException(status_code=502, detail="The private file could not be permanently removed. Nothing was changed.") from exc
        with get_db_connection() as connection:
            connection.execute("DELETE FROM library_files WHERE id = ? AND lower(owner_email) = ? AND deleted_at <> ''", (file_id, email))
        record_audit_log(action="library.file.permanently_deleted", email=email, request=request, resource_type="library_file", resource_name=file_id)
        return {"deleted": True}

    @app.post("/api/library/export")
    async def export_library(
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        enforce_rate_limit(scope="library_export", request=request, limit=3, window_seconds=3600, identity=current_user)
        email = normalize_email(current_user)
        with get_db_connection() as connection:
            rows = connection.execute(
                "SELECT * FROM library_files WHERE lower(owner_email) = ? AND deleted_at = '' ORDER BY created_at ASC",
                (email,),
            ).fetchall()
            folders = connection.execute(
                "SELECT id, name FROM library_folders WHERE lower(owner_email) = ? AND deleted_at = ''",
                (email,),
            ).fetchall()
        folder_names = {compact_text(row["id"]): compact_text(row["name"], "Folder") for row in folders}

        def build_export() -> bytes:
            buffer = BytesIO()
            manifest: list[dict[str, Any]] = []
            used_names: set[str] = set()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as archive:
                for row in rows:
                    display_name = compact_text(row["original_name"], "Library file")
                    folder = folder_names.get(compact_text(row["folder_id"]), "")
                    safe_name = "/".join(part for part in [folder, display_name] if part).replace("..", "_").replace("\\", "_")
                    candidate, suffix = safe_name, 2
                    while candidate.lower() in used_names:
                        stem, dot, extension = safe_name.rpartition(".")
                        candidate = f"{stem or safe_name} ({suffix}){dot}{extension}" if dot else f"{safe_name} ({suffix})"
                        suffix += 1
                    content = library_object_storage.get(compact_text(row["object_key"]))
                    archive.writestr(candidate, content)
                    used_names.add(candidate.lower())
                    manifest.append({
                        "id": compact_text(row["id"]), "name": display_name, "path": candidate,
                        "content_type": compact_text(row["content_type"]), "size_bytes": int(row["size_bytes"] or 0),
                        "created_at": compact_text(row["created_at"]), "source_type": compact_text(row["source_type"]),
                    })
                archive.writestr("mabaso-library-manifest.json", json.dumps({"exported_at": utc_now().isoformat(), "files": manifest}, indent=2))
            return buffer.getvalue()

        try:
            content = await asyncio.to_thread(build_export)
        except library_storage_error as exc:
            raise HTTPException(status_code=502, detail="Library export could not read one of your private files. Please try again.") from exc
        record_audit_log(action="library.export.created", email=email, request=request, resource_type="library", metadata={"file_count": len(rows)})
        return Response(content=content, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=\"mabaso-library-export.zip\""})

    @app.delete("/api/library/files")
    async def delete_all_library_files(
        payload: LibraryDeleteAllRequest,
        request: Request,
        current_user: str = Depends(require_authenticated_user),
    ):
        if payload.confirmation != "DELETE":
            raise HTTPException(status_code=422, detail="Type DELETE to confirm.")
        email = normalize_email(current_user)
        now_iso = utc_now().isoformat()
        with get_db_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            cursor = connection.execute(
                "UPDATE library_files SET deleted_at = ?, status = 'deleted', updated_at = ? WHERE lower(owner_email) = ? AND deleted_at = ''",
                (now_iso, now_iso, email),
            )
            connection.execute(
                "INSERT INTO library_storage_accounts (owner_email, committed_bytes, reserved_bytes, updated_at) VALUES (?, 0, 0, ?) ON CONFLICT(owner_email) DO UPDATE SET committed_bytes = 0, updated_at = excluded.updated_at",
                (email, now_iso),
            )
        deleted_count = max(0, int(cursor.rowcount or 0))
        record_audit_log(action="library.files.deleted_all", email=email, request=request, resource_type="library", metadata={"count": deleted_count})
        return {"deleted": deleted_count, "storage": await asyncio.to_thread(get_library_storage_summary, email)}

    @app.post("/api/library/references/files/{file_id}")
    async def select_library_file_reference(
        file_id: str,
        current_user: str = Depends(require_authenticated_user),
    ):
        row = await asyncio.to_thread(get_owned_library_file, current_user, file_id)
        if not row:
            raise HTTPException(status_code=404, detail="Library file not found or no longer available.")
        return {"file": serialize_library_file(row), "library_file_id": compact_text(file_id), "selected": True}

    @app.post("/api/library/references/links/{link_id}")
    async def select_library_link_reference(
        link_id: str,
        current_user: str = Depends(require_authenticated_user),
    ):
        row = await asyncio.to_thread(get_owned_link, current_user, link_id)
        if not row:
            raise HTTPException(status_code=404, detail="Saved link not found or no longer available.")
        return {"link": serialize_link(row), "library_link_id": compact_text(link_id), "selected": True}
