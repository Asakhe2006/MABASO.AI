import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Download, ExternalLink, File, FileAudio,
  FileImage, FileSpreadsheet, FileText, Folder, FolderOpen, FolderPlus, Images, Link,
  LoaderCircle, Maximize2, Minus, MoreVertical, Plus, Search, Settings2, Star, Trash2, UploadCloud, X,
} from "lucide-react";
import "./PersonalLibrary.css";
import LibrarySettingsPanel from "./LibrarySettingsPanel";

const SECTIONS = [
  ["all", "All Files", FolderOpen],
  ["favorites", "Favourites", Star],
  ["folders", "Folders", Folder],
  ["images", "Images", Images],
  ["links", "Links", Link],
  ["recordings", "Recordings", FileAudio],
  ["transcripts", "Transcripts", FileText],
];

const formatBytes = (value = 0) => {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / (1024 ** 2)).toFixed(bytes >= 10 * 1024 ** 2 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const iconFor = (category) => {
  if (category === "image") return FileImage;
  if (category === "audio") return FileAudio;
  if (category === "spreadsheet") return FileSpreadsheet;
  if (["document", "note"].includes(category)) return FileText;
  return File;
};

const itemKey = (item) => `${item.item_type || "file"}:${item.id}`;

const readApiError = (payload, fallback) => {
  if (typeof payload?.detail === "string" && payload.detail.trim()) return payload.detail;
  if (typeof payload?.detail?.message === "string" && payload.detail.message.trim()) return payload.detail.message;
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
  return fallback;
};

export default function PersonalLibrary({
  apiBaseUrl,
  authFetch,
  picker = false,
  onAttach,
  onClose,
  onBack,
  onUpgrade,
  initialSection = "all",
  initialItemId = "",
}) {
  const [section, setSection] = useState(initialSection || "all");
  const [activeFolderId, setActiveFolderId] = useState("");
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [links, setLinks] = useState([]);
  const [storage, setStorage] = useState(null);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [preferences, setPreferences] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachingId, setAttachingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageCheckoutPackage, setStorageCheckoutPackage] = useState(null);
  const [storagePaymentMethod, setStoragePaymentMethod] = useState("payfast");
  const [isStartingStoragePayment, setIsStartingStoragePayment] = useState(false);
  const [storagePaymentDetails, setStoragePaymentDetails] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [selectedImageIds, setSelectedImageIds] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [nextBefore, setNextBefore] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [folderDialog, setFolderDialog] = useState(null);
  const [folderDeleteTarget, setFolderDeleteTarget] = useState(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ url: "", title: "", description: "" });
  const [bulkFolderId, setBulkFolderId] = useState("");
  const [menuKey, setMenuKey] = useState("");
  const [storageDialogOpen, setStorageDialogOpen] = useState(false);
  const inputRef = useRef(null);
  const viewerPointerStart = useRef(null);
  const authFetchRef = useRef(authFetch);
  const catalogRequestIdRef = useRef(0);
  const storageRequestIdRef = useRef(0);
  const appendInFlightRef = useRef(false);

  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  const loadStorage = useCallback(async () => {
    const requestId = storageRequestIdRef.current + 1;
    storageRequestIdRef.current = requestId;
    setIsStorageLoading(true);
    setStorageError("");
    try {
      const response = await authFetchRef.current("/api/library/storage");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readApiError(data, "Could not load your storage details."));
      if (requestId !== storageRequestIdRef.current) return;
      const nextStorage = data.storage || data;
      if (!nextStorage || typeof nextStorage !== "object" || !Number.isFinite(Number(nextStorage.limit_bytes))) {
        throw new Error("Storage details were incomplete. Please try again.");
      }
      setStorage(nextStorage);
    } catch (requestError) {
      if (requestId === storageRequestIdRef.current) {
        setStorageError(requestError.message || "Could not load your storage details.");
      }
    } finally {
      if (requestId === storageRequestIdRef.current) setIsStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStorage();
  }, [loadStorage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get("session_id") || "";
    if (params.get("storage") !== "success" || !checkoutId.startsWith("mabaso-storage-")) return undefined;
    let cancelled = false;
    let timerId = 0;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const response = await authFetchRef.current(`/api/billing/checkout-sessions/${encodeURIComponent(checkoutId)}`);
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && data.complete) {
          if (data.storage) setStorage(data.storage);
          else await loadStorage();
          setNotice("Payment confirmed. Your Library storage has been extended.");
          params.delete("storage");
          params.delete("session_id");
          const search = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
          return;
        }
      } catch { /* PayFast may still be delivering the verified notification. */ }
      if (!cancelled && attempts < 15) timerId = window.setTimeout(poll, 2000);
      else if (!cancelled) setNotice("Payment confirmation is still arriving. Your storage will update automatically after PayFast verifies it.");
    };
    void poll();
    return () => { cancelled = true; if (timerId) window.clearTimeout(timerId); };
  }, [loadStorage]);

  const loadCatalog = useCallback(async ({ append = false, before = "", nextSection = section, folderId = activeFolderId } = {}) => {
    if (append && appendInFlightRef.current) return;
    const requestId = append ? catalogRequestIdRef.current : catalogRequestIdRef.current + 1;
    if (!append) {
      catalogRequestIdRef.current = requestId;
      appendInFlightRef.current = false;
      setIsLoadingMore(false);
      setIsLoading(true);
    } else {
      appendInFlightRef.current = true;
      setIsLoadingMore(true);
    }
    setError("");
    try {
      const params = new URLSearchParams({ section: nextSection, limit: "30" });
      if (query.trim()) params.set("search", query.trim());
      if (folderId) params.set("folder_id", folderId);
      if (before) params.set("before", before);
      const response = await authFetchRef.current(`/api/library/catalog?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readApiError(data, "Could not load your Library."));
      if (requestId !== catalogRequestIdRef.current) return;
      const nextFiles = Array.isArray(data.files) ? data.files : [];
      setFiles((current) => append ? [...current, ...nextFiles.filter((row) => !current.some((item) => item.id === row.id))] : nextFiles);
      setFolders(Array.isArray(data.folders) ? data.folders : []);
      setLinks(Array.isArray(data.links) ? data.links : []);
      if (data.storage) {
        setStorage(data.storage);
        setStorageError("");
        setIsStorageLoading(false);
      }
      setPreferences(data.preferences || { auto_save_links: false });
      setNextBefore(data.next_before || "");
      setHasMore(Boolean(data.has_more));
    } catch (requestError) {
      if (requestId === catalogRequestIdRef.current) setError(requestError.message || "Could not load your Library.");
    } finally {
      if (requestId === catalogRequestIdRef.current) {
        if (append) {
          appendInFlightRef.current = false;
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    }
  }, [activeFolderId, query, section]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadCatalog(), query ? 220 : 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadCatalog, query]);

  useEffect(() => {
    if (isLoading || isLoadingMore || !hasMore || !nextBefore || section === "folders" || section === "links") return undefined;
    const timeoutId = window.setTimeout(() => {
      void loadCatalog({ append: true, before: nextBefore });
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [hasMore, isLoading, isLoadingMore, loadCatalog, nextBefore, section]);

  useEffect(() => {
    if (preferences.storage_warnings === false || !storage?.limit_bytes) return;
    const percent = Math.round((Number(storage.used_bytes || 0) / Number(storage.limit_bytes)) * 100);
    const threshold = percent >= 100 ? 100 : percent >= 95 ? 95 : percent >= 80 ? 80 : 0;
    if (!threshold) return;
    const warningKey = `mabaso.library.storage-warning.${threshold}.${storage.limit_bytes}`;
    try {
      if (window.sessionStorage.getItem(warningKey)) return;
      window.sessionStorage.setItem(warningKey, "shown");
    } catch { /* display the warning even if session storage is unavailable */ }
    setNotice(threshold >= 100
      ? "Library storage is full. Existing files remain available, but new permanent uploads are paused."
      : threshold >= 95
        ? `Library storage is ${percent}% full. Delete files or manage storage soon.`
        : `Library storage is ${percent}% used.`);
  }, [preferences.storage_warnings, storage?.limit_bytes, storage?.used_bytes]);

  useEffect(() => {
    if (!initialItemId || isLoading) return;
    const requested = files.find((item) => item.id === initialItemId);
    if (requested) {
      setSelectedFile(requested);
      return;
    }
    const requestedFolder = folders.find((item) => item.id === initialItemId);
    if (requestedFolder) {
      setActiveFolderId(requestedFolder.id);
      setSection("all");
    }
  }, [files, folders, initialItemId, isLoading]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const close = (event) => { if (event.key === "Escape") setSettingsOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [settingsOpen]);

  useEffect(() => {
    if (!selectedFile) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSelectedFile(null);
      if (selectedFile.category === "image" && event.key === "ArrowLeft") navigateImage(-1);
      if (selectedFile.category === "image" && event.key === "ArrowRight") navigateImage(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const uploadFiles = async (selected) => {
    const chosen = Array.from(selected || []);
    if (!chosen.length) return;
    setIsUploading(true);
    setError("");
    try {
      for (const file of chosen) {
        const submitFile = async (duplicateAction = "") => {
          const body = new FormData();
          body.append("file", file);
          if (duplicateAction) body.append("duplicate_action", duplicateAction);
          const response = await authFetch("/api/library/files", { method: "POST", body, timeoutMs: 120000 });
          return { response, data: await response.json().catch(() => ({})) };
        };
        let { response, data } = await submitFile();
        if (response.status === 409 && data.detail?.code === "LIBRARY_DUPLICATE_FOUND") {
          const keepBoth = window.confirm(`${file.name} is already in your Library. Select OK to keep both copies, or Cancel to skip this duplicate.`);
          if (!keepBoth) continue;
          ({ response, data } = await submitFile("keep_both"));
        }
        const detail = data.detail && typeof data.detail === "object" ? data.detail.message : data.detail;
        if (!response.ok) throw new Error(detail || `Could not save ${file.name}.`);
      }
      setNotice(`${chosen.length} file${chosen.length === 1 ? "" : "s"} saved to Library.`);
      await loadCatalog();
    } catch (uploadError) {
      setError(uploadError.message || "The file could not be uploaded.");
    } finally {
      setIsUploading(false);
    }
  };

  const submitProviderForm = (checkout) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = checkout.checkout_url;
    form.style.display = "none";
    Object.entries(checkout.fields || {}).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value ?? "");
      form.appendChild(input);
    });
    document.body.appendChild(form);
    window.HTMLFormElement.prototype.submit.call(form);
  };

  const startStoragePayment = async () => {
    if (!storageCheckoutPackage || isStartingStoragePayment) return;
    setIsStartingStoragePayment(true);
    setError("");
    try {
      if (storagePaymentMethod === "payfast") {
        const response = await authFetch("/api/library/storage/checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package_id: storageCheckoutPackage.id, provider: "payfast" }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "PayFast checkout could not start.");
        submitProviderForm(data);
        return;
      }
      const response = await authFetch("/api/payments/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: storageCheckoutPackage.id, product_type: "storage_addon" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "PayShap payment request could not be created.");
      setStoragePaymentDetails(data);
    } catch (paymentError) {
      setError(paymentError.message || "Storage payment could not start.");
    } finally {
      setIsStartingStoragePayment(false);
    }
  };

  const attachItem = async (item, { closePicker = true } = {}) => {
    if (!onAttach) return;
    const type = item.item_type === "link" ? "links" : "files";
    setAttachingId(itemKey(item));
    setError("");
    try {
      const response = await authFetch(`/api/library/references/${type}/${encodeURIComponent(item.id)}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "This Library item could not be selected.");
      onAttach(item.item_type === "link" ? {
        id: `library-link-${item.id}`,
        libraryLinkId: item.id,
        name: item.title || item.domain,
        type: "text/uri-list",
        kind: "link",
        url: item.url,
      } : {
        id: `library-${item.id}`,
        libraryFileId: item.id,
        name: item.name,
        type: item.content_type,
        kind: item.category === "image" ? "image" : "document",
        dataUrl: "",
        text: "",
        receipt: "",
      });
      setNotice(`${item.name || item.title || "Library item"} added to the chat composer.`);
      if (picker && closePicker) onClose?.();
    } catch (attachError) {
      setError(attachError.message || "This Library item could not be selected.");
    } finally {
      setAttachingId("");
    }
  };

  const patchItem = async (item, updates) => {
    const base = item.item_type === "link" ? "/api/library/links" : item.item_type === "folder" ? "/api/library/folders" : "/api/library/files";
    const response = await authFetch(`${base}/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "The Library item could not be updated.");
    return data.file || data.folder || data.link;
  };

  const toggleFavourite = async (item) => {
    const next = !item.is_favorite;
    const updateList = (setter) => setter((current) => current.map((row) => row.id === item.id ? { ...row, is_favorite: next } : row));
    if (item.item_type === "folder") updateList(setFolders);
    else if (item.item_type === "link") updateList(setLinks);
    else updateList(setFiles);
    try {
      await patchItem(item, { is_favorite: next });
      if (section === "favorites" && !next) {
        if (item.item_type === "link") setLinks((current) => current.filter((row) => row.id !== item.id));
        else setFiles((current) => current.filter((row) => row.id !== item.id));
      }
    } catch (favoriteError) {
      if (item.item_type === "folder") setFolders((current) => current.map((row) => row.id === item.id ? item : row));
      else if (item.item_type === "link") setLinks((current) => current.map((row) => row.id === item.id ? item : row));
      else setFiles((current) => current.map((row) => row.id === item.id ? item : row));
      setError(favoriteError.message);
    }
  };

  const moveFile = async (file, folderId) => {
    try {
      const updated = await patchItem(file, { folder_id: folderId });
      setFiles((current) => current.map((row) => row.id === file.id ? updated : row));
      if (activeFolderId && folderId !== activeFolderId) setFiles((current) => current.filter((row) => row.id !== file.id));
      setNotice(folderId ? "Moved to folder." : "Moved to All Files.");
    } catch (moveError) {
      setError(moveError.message);
    }
  };

  const saveFolder = async () => {
    const name = String(folderDialog?.name || "").trim();
    if (!name) return;
    const editing = folderDialog?.folder;
    const response = await authFetch(editing ? `/api/library/folders/${encodeURIComponent(editing.id)}` : "/api/library/folders", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.detail || "The folder could not be saved.");
    setFolderDialog(null);
    setNotice(editing ? "Folder renamed." : "Folder created.");
    await loadCatalog();
  };

  const deleteFolder = async (deleteContents) => {
    if (!folderDeleteTarget) return;
    const response = await authFetch(`/api/library/folders/${encodeURIComponent(folderDeleteTarget.id)}?delete_contents=${deleteContents ? "true" : "false"}`, { method: "DELETE", timeoutMs: 120000 });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.detail || "The folder could not be deleted.");
    if (activeFolderId === folderDeleteTarget.id) setActiveFolderId("");
    setFolderDeleteTarget(null);
    setNotice(deleteContents ? "Folder and its Library contents deleted." : "Folder deleted. Its contents remain in All Files.");
    await loadCatalog({ nextSection: "folders", folderId: "" });
  };

  const saveLink = async () => {
    const response = await authFetch("/api/library/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...linkDraft, folder_id: activeFolderId || "", source_type: "manual" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.detail || "The link could not be saved.");
    setLinkDialogOpen(false);
    setLinkDraft({ url: "", title: "", description: "" });
    setNotice(data.deduplicated ? "This link was already in your Library." : "Link saved to Library.");
    await loadCatalog({ nextSection: "links" });
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Remove ${item.name || item.title} from your Library?`)) return;
    const path = item.item_type === "link" ? `/api/library/links/${encodeURIComponent(item.id)}` : `/api/library/files/${encodeURIComponent(item.id)}`;
    const response = await authFetch(path, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.detail || "The Library item could not be deleted.");
    if (item.item_type === "link") setLinks((current) => current.filter((row) => row.id !== item.id));
    else setFiles((current) => current.filter((row) => row.id !== item.id));
    if (data.storage) setStorage(data.storage);
  };

  const updateAutoSave = async (checked) => {
    setPreferences({ auto_save_links: checked });
    const response = await authFetch("/api/library/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_save_links: checked }),
    });
    if (!response.ok) {
      setPreferences({ auto_save_links: !checked });
      setError("The automatic link-saving preference could not be updated.");
      return;
    }
    try { window.localStorage.setItem("mabaso.library.auto-save-links", String(checked)); } catch { /* backend remains authoritative */ }
    window.dispatchEvent(new CustomEvent("mabaso-library-auto-save-links", { detail: checked }));
  };

  const imageFiles = useMemo(() => files.filter((item) => item.category === "image"), [files]);
  const attachSelectedImages = async () => {
    const chosen = imageFiles.filter((item) => selectedImageIds.has(item.id));
    for (const item of chosen) await attachItem(item, { closePicker: false });
    if (picker && chosen.length) onClose?.();
  };
  const visibleItems = useMemo(() => section === "favorites" ? [
    ...files,
    ...folders.filter((item) => item.is_favorite).map((item) => ({ ...item, item_type: "folder" })),
    ...links,
  ] : section === "links" ? links : files, [files, folders, links, section]);
  const usagePercent = useMemo(() => storage?.limit_bytes ? Math.min(100, Math.round((Number(storage.used_bytes || 0) / Number(storage.limit_bytes)) * 100)) : 0, [storage]);
  const storagePackages = Array.isArray(storage?.addon_catalog) ? storage.addon_catalog : [];
  const contentUrl = (file, download = false) => `${apiBaseUrl}/api/library/files/${encodeURIComponent(file.id)}/content${download ? "?download=true" : ""}`;
  const previewable = (file) => file.content_type === "application/pdf" || file.content_type?.startsWith("image/") || file.content_type?.startsWith("audio/") || file.content_type?.startsWith("text/");

  const changeSection = (next) => {
    setSection(next);
    setActiveFolderId("");
    setSelectedImageIds(new Set());
    setIsSelectMode(false);
    setQuery("");
  };

  const toggleImageSelection = (file, range = false) => {
    setSelectedImageIds((current) => {
      const next = new Set(current);
      if (range && current.size) {
        const lastId = [...current].at(-1);
        const start = imageFiles.findIndex((item) => item.id === lastId);
        const end = imageFiles.findIndex((item) => item.id === file.id);
        imageFiles.slice(Math.min(start, end), Math.max(start, end) + 1).forEach((item) => next.add(item.id));
      } else if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);
      return next;
    });
  };

  const bulkUpdate = async (updates) => {
    const ids = [...selectedImageIds];
    if (!ids.length) return;
    const response = await authFetch("/api/library/files/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ids, ...updates }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.detail || "The selected images could not be updated.");
    setSelectedImageIds(new Set());
    await loadCatalog();
  };

  const navigateImage = (direction) => {
    const currentIndex = imageFiles.findIndex((item) => item.id === selectedFile?.id);
    if (currentIndex < 0 || !imageFiles.length) return;
    const next = imageFiles[(currentIndex + direction + imageFiles.length) % imageFiles.length];
    setViewerZoom(1);
    setSelectedFile(next);
  };

  const renderFavourite = (item) => <button type="button" className={`library-star ${item.is_favorite ? "is-active" : ""}`} aria-label={item.is_favorite ? "Remove from Favourites" : "Add to Favourites"} aria-pressed={item.is_favorite} onClick={(event) => { event.stopPropagation(); void toggleFavourite(item); }}><Star aria-hidden="true" fill={item.is_favorite ? "currentColor" : "none"} /></button>;

  const renderFileRow = (file) => {
    const Icon = iconFor(file.category);
    return <article key={file.id} className="personal-library-row">
      <button type="button" className="personal-library-file-main" onClick={() => picker ? void attachItem(file) : setSelectedFile(file)} disabled={attachingId === itemKey(file)}>
        <Icon aria-hidden="true" /><span><strong>{file.name}</strong><small>{file.category} · {formatBytes(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString()}</small></span>
        {attachingId === itemKey(file) ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      </button>
      <div className="personal-library-row-actions">
        {renderFavourite(file)}
        <button type="button" aria-label={`More actions for ${file.name}`} onClick={() => setMenuKey((value) => value === itemKey(file) ? "" : itemKey(file))}><MoreVertical aria-hidden="true" /></button>
        {menuKey === itemKey(file) ? <div className="library-item-menu">
          {!picker ? <button type="button" onClick={() => setSelectedFile(file)}>Preview</button> : null}
          {onAttach ? <button type="button" onClick={() => void attachItem(file)}>Add to Chat</button> : null}
          <a href={contentUrl(file, true)}>Download</a>
          <label>Move to<select value={file.folder_id || ""} onChange={(event) => void moveFile(file, event.target.value)}><option value="">All Files</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
          {!picker ? <button type="button" className="is-danger" onClick={() => void deleteItem(file)}>Delete</button> : null}
        </div> : null}
      </div>
    </article>;
  };

  return (
    <section className={`personal-library ${picker ? "is-picker" : ""} ${preferences.default_view === "grid" ? "is-grid-view" : ""}`} aria-label={picker ? "Choose from Library" : "Library"}>
      <header className="personal-library-header">
        <div>{picker ? <button type="button" className="personal-library-back" onClick={onClose}><ArrowLeft aria-hidden="true" />Back to chat</button> : <button type="button" className="personal-library-back" onClick={() => onBack ? onBack() : window.history.back()}><ArrowLeft aria-hidden="true" />Back</button>}<p className="personal-library-eyebrow">Personal study resources</p><h1>{picker ? "Add from Library" : "Library"}</h1><p>Your files, images, recordings, transcripts and saved educational links in one private place.</p></div>
        {picker ? <button type="button" className="personal-library-close" onClick={onClose} aria-label="Close Library"><X aria-hidden="true" /></button> : <FolderOpen className="personal-library-heading-icon" aria-hidden="true" />}
      </header>

      <nav className="library-section-tabs" aria-label="Library sections">
        {SECTIONS.map(([id, label, Icon]) => <button type="button" key={id} className={section === id ? "is-active" : ""} onClick={() => changeSection(id)}>{createElement(Icon, { "aria-hidden": true })}<span>{label}</span></button>)}
      </nav>

      <div className="personal-library-toolbar">
        <label><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${activeFolderId ? "this folder" : "your Library"}…`} aria-label="Search Library" /></label>
        {!picker ? <button type="button" className="is-secondary" onClick={() => setSettingsOpen(true)}><Settings2 aria-hidden="true" /><span>Settings</span></button> : null}
        <button type="button" className="is-secondary" onClick={() => setFolderDialog({ name: "" })}><FolderPlus aria-hidden="true" />New Folder</button>
        {section === "links" ? <button type="button" className="is-secondary" onClick={() => setLinkDialogOpen(true)}><Link aria-hidden="true" />Save link</button> : <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading || !storage?.storage_configured}><UploadCloud aria-hidden="true" />{isUploading ? "Uploading…" : "Upload files"}</button>}
        <input ref={inputRef} type="file" multiple accept="image/*,audio/*,.pdf,.docx,.pptx,.xlsx,.csv,.tsv,.txt,.md,.json,.xml,.html,.htm,.rtf,.odt,.ods,.odp" className="hidden" onChange={(event) => { void uploadFiles(event.target.files); event.target.value = ""; }} />
      </div>

      {error ? <div className="personal-library-error" role="alert">{error}<button type="button" onClick={() => { setError(""); void loadCatalog(); }}>Retry</button></div> : null}
      {notice ? <div className="personal-library-success" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X /></button></div> : null}
      {storage && storage.storage_configured === false && !isStorageLoading ? <div className="personal-library-notice">Private object storage is not configured yet. Existing Library metadata remains protected, but new uploads are paused.</div> : null}

      {section === "links" ? <label className="library-link-setting"><input type="checkbox" checked={Boolean(preferences.auto_save_links)} onChange={(event) => void updateAutoSave(event.target.checked)} /><span><strong>Automatically save useful chat sources</strong><small>Verified links cited in AI Chat can be added here. URLs with private sign-in data are rejected.</small></span></label> : null}

      {section === "folders" ? <div className="library-folder-grid">
        {folders.map((folder) => <article key={folder.id} className={activeFolderId === folder.id ? "is-active" : ""}><button type="button" onClick={() => { setActiveFolderId(folder.id); setSection("all"); }}><Folder aria-hidden="true" /><span><strong>{folder.name}</strong><small>{folder.item_count} item{folder.item_count === 1 ? "" : "s"}</small></span></button>{renderFavourite({ ...folder, item_type: "folder" })}<button type="button" onClick={() => setFolderDialog({ folder, name: folder.name })} aria-label={`Rename ${folder.name}`}><MoreVertical /></button><button type="button" onClick={() => setFolderDeleteTarget(folder)} aria-label={`Delete ${folder.name}`}><Trash2 /></button></article>)}
        {!isLoading && !folders.length ? <div className="personal-library-empty"><FolderPlus /><h2>No folders yet</h2><p>Create a folder to organise files and saved links without duplicating their storage.</p></div> : null}
      </div> : section === "images" ? <>
        <div className="library-gallery-head"><span>{selectedImageIds.size ? `${selectedImageIds.size} image${selectedImageIds.size === 1 ? "" : "s"} selected` : `${imageFiles.length} image${imageFiles.length === 1 ? "" : "s"}`}</span><button type="button" onClick={() => { setIsSelectMode((value) => !value); setSelectedImageIds(new Set()); }}>{isSelectMode ? "Cancel selection" : "Select"}</button></div>
        {selectedImageIds.size ? <div className="library-selection-toolbar"><button type="button" onClick={() => void attachSelectedImages()} disabled={!onAttach || Boolean(attachingId)}>Add to Chat</button><select value={bulkFolderId} onChange={(event) => setBulkFolderId(event.target.value)}><option value="">All Files</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><button type="button" onClick={() => void bulkUpdate({ folder_id: bulkFolderId })}>Move</button><button type="button" onClick={() => void bulkUpdate({ is_favorite: true })}>Favourite</button>{selectedImageIds.size === 1 ? <a href={contentUrl(imageFiles.find((item) => selectedImageIds.has(item.id)), true)}>Download</a> : null}<button type="button" onClick={() => setSelectedImageIds(new Set())}>Cancel</button></div> : null}
        <div className="library-image-grid" aria-busy={isLoading}>{imageFiles.map((file) => <article key={file.id} className={selectedImageIds.has(file.id) ? "is-selected" : ""}><button type="button" className="library-image-open" onClick={(event) => (isSelectMode || event.ctrlKey || event.metaKey || event.shiftKey) ? toggleImageSelection(file, event.shiftKey) : setSelectedFile(file)}><img src={contentUrl(file)} loading="lazy" alt={file.name} /><span>{file.name}</span></button><button type="button" className="library-image-check" aria-label={`Select ${file.name}`} aria-pressed={selectedImageIds.has(file.id)} onClick={() => toggleImageSelection(file)}>{selectedImageIds.has(file.id) ? <Check /> : null}</button>{renderFavourite(file)}</article>)}</div>
        {!isLoading && !imageFiles.length ? <div className="personal-library-empty"><Images /><h2>No saved images yet</h2><p>Eligible images you upload and retain will appear here.</p></div> : null}
      </> : <div className="personal-library-list" aria-busy={isLoading}>
        {activeFolderId ? <div className="library-folder-breadcrumb"><button type="button" onClick={() => setActiveFolderId("")}><ArrowLeft />All Files</button><strong>{folders.find((folder) => folder.id === activeFolderId)?.name}</strong></div> : null}
        {isLoading ? Array.from({ length: 5 }, (_, index) => <div className="personal-library-skeleton" key={index} />) : visibleItems.length ? visibleItems.map((item) => item.item_type === "folder" ? <article key={itemKey(item)} className="personal-library-row">{renderFavourite(item)}<button type="button" className="personal-library-file-main" onClick={() => { setActiveFolderId(item.id); setSection("all"); }}><Folder /><span><strong>{item.name}</strong><small>{item.item_count} items</small></span></button></article> : item.item_type === "link" ? <article key={itemKey(item)} className="personal-library-row"><button type="button" className="personal-library-file-main" onClick={() => picker ? void attachItem(item) : window.open(item.url, "_blank", "noopener,noreferrer")}><Link /><span><strong>{item.title}</strong><small>{item.domain} · saved {new Date(item.created_at).toLocaleDateString()}</small></span></button><div className="personal-library-row-actions">{renderFavourite(item)}{onAttach ? <button type="button" onClick={() => void attachItem(item)} aria-label="Add link to Chat"><Plus /></button> : null}<a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title}`}><ExternalLink /></a><button type="button" onClick={() => void deleteItem(item)} aria-label={`Remove ${item.title}`}><Trash2 /></button></div></article> : renderFileRow(item)) : <div className="personal-library-empty"><FolderOpen /><h2>Nothing here yet</h2><p>{section === "favorites" ? "Use the star beside files, folders, images or links to keep important resources together." : "Upload a personal study source, save a useful link, or choose another Library section."}</p></div>}
      </div>}
      {isLoadingMore ? <div className="personal-library-progress" role="status"><LoaderCircle className="animate-spin" aria-hidden="true" />Loading more Library items...</div> : null}
      {hasMore && !isLoadingMore && section !== "folders" && section !== "links" ? <button type="button" className="personal-library-load-more" onClick={() => void loadCatalog({ append: true, before: nextBefore })}>Load more now</button> : null}

      <button type="button" className={`personal-library-storage ${!storage ? "is-degraded" : ""}`} onClick={() => { setStorageDialogOpen(true); if (!storage && !isStorageLoading) void loadStorage(); }} aria-busy={isStorageLoading}>
        <span><strong>Storage</strong><small>{storage ? `${formatBytes(storage.used_bytes)} of ${formatBytes(storage.limit_bytes)} used` : isStorageLoading ? "Checking your storage allowance…" : "Storage details are temporarily unavailable"}</small></span>
        <span className="personal-library-storage-track"><i style={{ width: `${storage ? usagePercent : 0}%` }} /></span>
        <em>{storage ? `${formatBytes(storage.remaining_bytes)} remaining · Manage storage` : isStorageLoading ? "Loading…" : "Open storage manager to retry"}</em>
      </button>

      {storageDialogOpen ? <div className="library-dialog-backdrop" onPointerDown={() => setStorageDialogOpen(false)}><div className="library-dialog library-storage-dialog" role="dialog" aria-modal="true" aria-label="Manage storage" onPointerDown={(event) => event.stopPropagation()}>
        <header><button type="button" onClick={() => setStorageDialogOpen(false)} aria-label="Back to Library"><ArrowLeft /></button><div><h2>Manage Storage</h2><p>{storage ? `${String(storage.plan_id || "free").replaceAll("_", " ")} plan · Personal Library` : "Personal Library"}</p></div><button type="button" onClick={() => setStorageDialogOpen(false)} aria-label="Close storage manager"><X /></button></header>
        {!storage ? <section className="library-storage-unavailable" role="status"><LoaderCircle className={isStorageLoading ? "animate-spin" : ""} aria-hidden="true" /><h3>{isStorageLoading ? "Loading storage details…" : "Storage details are unavailable"}</h3><p>{storageError || "Your files remain protected. Retry to load your allowance and storage packages."}</p>{!isStorageLoading ? <button type="button" className="is-primary" onClick={() => void loadStorage()}>Retry</button> : null}</section> : <>
        <section className="library-storage-summary"><span><strong>Your storage</strong><small>{formatBytes(storage.used_bytes)} / {formatBytes(storage.limit_bytes)}</small></span><span className="personal-library-storage-track"><i style={{ width: `${usagePercent}%` }} /></span><p>{formatBytes(storage.remaining_bytes)} remaining</p></section>
        <section>
          <div className="library-storage-section-heading"><div><h3>Buy extra storage</h3><p>Choose how to pay, then select the storage package you want.</p></div></div>
          <div className="library-storage-methods" aria-label="Choose storage payment method">
            <label className={!storage.addon_checkout?.payfast_enabled ? "is-disabled" : ""}><input type="radio" name="storage-payment" value="payfast" checked={storagePaymentMethod === "payfast"} disabled={!storage.addon_checkout?.payfast_enabled} onChange={() => { setStoragePaymentMethod("payfast"); setStoragePaymentDetails(null); }} /><span><strong>PayFast</strong><small>Card payment · renews monthly</small></span></label>
            <label className={!storage.addon_checkout?.payshap_enabled ? "is-disabled" : ""}><input type="radio" name="storage-payment" value="payshap" checked={storagePaymentMethod === "payshap"} disabled={!storage.addon_checkout?.payshap_enabled} onChange={() => { setStoragePaymentMethod("payshap"); setStoragePaymentDetails(null); }} /><span><strong>PayShap</strong><small>Once-off payment · 30 days</small></span></label>
          </div>
          <div className="library-storage-package-grid">{storagePackages.map((storagePackage) => {
            const isSelected = storageCheckoutPackage?.id === storagePackage.id;
            return <article key={storagePackage.id} className={`${storagePackage.recommended ? "is-recommended" : ""} ${isSelected ? "is-selected" : ""}`.trim()}><span>{storagePackage.recommended ? "Popular" : "Storage"}</span><h4>{storagePackage.name}</h4><strong>+{formatBytes(storagePackage.capacity_bytes)}</strong><p><b>R{storagePackage.amount_zar}</b> / {storagePaymentMethod === "payfast" ? "month" : "30 days"}</p><small>New total: {formatBytes(Number(storage.base_limit_bytes || storage.limit_bytes || 0) + Number(storagePackage.capacity_bytes || 0))}</small><button type="button" disabled={!storage.addon_checkout?.enabled} aria-pressed={isSelected} onClick={() => { setStorageCheckoutPackage(storagePackage); setStoragePaymentDetails(null); }}>{storage.addon_checkout?.enabled ? (isSelected ? "Selected" : "Select package") : "Payment setup required"}</button></article>;
          })}</div>
          <p className="library-storage-provider-note">{storage.addon_checkout?.message || "Storage payment is unavailable."}</p>
        </section>
        {storageCheckoutPackage ? <section className="library-storage-payment-step" aria-label="Confirm storage purchase"><div className="library-storage-section-heading"><div><h3>Selected package</h3><p>{storageCheckoutPackage.name} · +{formatBytes(storageCheckoutPackage.capacity_bytes)} · R{storageCheckoutPackage.amount_zar}</p></div><button type="button" onClick={() => { setStorageCheckoutPackage(null); setStoragePaymentDetails(null); }} aria-label="Clear selected package"><X /></button></div>{storagePaymentDetails ? <div className="library-payshap-details"><strong>Pay R{storagePaymentDetails.amount} with PayShap</strong><p>Open your banking app, choose PayShap, and use the exact reference. Storage is added after verification.</p><dl><div><dt>PayShap number</dt><dd>{storagePaymentDetails.payment_details?.payshap_number}</dd></div><div><dt>Account name</dt><dd>{storagePaymentDetails.payment_details?.account_name}</dd></div><div><dt>Reference</dt><dd>{storagePaymentDetails.payment_reference}</dd></div></dl></div> : <button type="button" className="is-primary" onClick={() => void startStoragePayment()} disabled={isStartingStoragePayment}>{isStartingStoragePayment ? "Opening payment…" : `Continue with ${storagePaymentMethod === "payfast" ? "PayFast" : "PayShap"}`}</button>}</section> : null}
        <section className="library-storage-upgrade"><div><h3>Upgrade your AI plan</h3><p>Increase included storage and unlock the plan's AI features.</p></div><button type="button" onClick={() => { setStorageDialogOpen(false); if (picker) onClose?.(); onUpgrade?.(); }} disabled={!onUpgrade}>Review plans</button></section>
        </>}
      </div></div> : null}

      {folderDialog ? <div className="library-dialog-backdrop" onPointerDown={() => setFolderDialog(null)}><div className="library-dialog" role="dialog" aria-modal="true" aria-label={folderDialog.folder ? "Rename folder" : "New folder"} onPointerDown={(event) => event.stopPropagation()}><h2>{folderDialog.folder ? "Rename folder" : "New folder"}</h2><input autoFocus value={folderDialog.name} onChange={(event) => setFolderDialog((current) => ({ ...current, name: event.target.value }))} placeholder="Folder name" maxLength={80} /><footer><button type="button" onClick={() => setFolderDialog(null)}>Cancel</button><button type="button" className="is-primary" onClick={() => void saveFolder()}>{folderDialog.folder ? "Save" : "Create"}</button></footer></div></div> : null}
      {folderDeleteTarget ? <div className="library-dialog-backdrop" onPointerDown={() => setFolderDeleteTarget(null)}><div className="library-dialog" role="dialog" aria-modal="true" aria-label="Delete folder" onPointerDown={(event) => event.stopPropagation()}><h2>Delete {folderDeleteTarget.name}?</h2><p>Choose whether its files and links return to All Files or are permanently removed from your Library.</p><footer className="is-stacked"><button type="button" onClick={() => setFolderDeleteTarget(null)}>Cancel</button><button type="button" onClick={() => void deleteFolder(false)}>Delete folder only</button><button type="button" className="is-danger" onClick={() => void deleteFolder(true)}>Delete folder and contents</button></footer></div></div> : null}
      {linkDialogOpen ? <div className="library-dialog-backdrop" onPointerDown={() => setLinkDialogOpen(false)}><div className="library-dialog" role="dialog" aria-modal="true" aria-label="Save website link" onPointerDown={(event) => event.stopPropagation()}><h2>Save website link</h2><input autoFocus type="url" value={linkDraft.url} onChange={(event) => setLinkDraft((current) => ({ ...current, url: event.target.value }))} placeholder="https://…" /><input value={linkDraft.title} onChange={(event) => setLinkDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Display title (optional)" /><textarea value={linkDraft.description} onChange={(event) => setLinkDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Short note (optional)" /><footer><button type="button" onClick={() => setLinkDialogOpen(false)}>Cancel</button><button type="button" className="is-primary" onClick={() => void saveLink()}>Save link</button></footer></div></div> : null}

      {selectedFile ? <div className={`personal-library-viewer ${selectedFile.category === "image" ? "is-image-viewer" : ""}`} role="dialog" aria-modal="true" aria-label={`Preview ${selectedFile.name}`} onPointerDown={(event) => { viewerPointerStart.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => { const start = viewerPointerStart.current; viewerPointerStart.current = null; if (selectedFile.category !== "image" || viewerZoom !== 1 || !start) return; const delta = event.clientX - start.x; if (Math.abs(delta) > 70) navigateImage(delta > 0 ? -1 : 1); }}>
        <header><button type="button" onClick={() => setSelectedFile(null)}><ArrowLeft />Back to Library</button><strong>{selectedFile.name}</strong><span className="library-viewer-actions">{selectedFile.category === "image" ? <><button type="button" onClick={() => setViewerZoom((value) => Math.max(.5, value - .25))} aria-label="Zoom out"><Minus /></button><button type="button" onClick={() => setViewerZoom(1)} aria-label="Fit image"><Maximize2 /></button><button type="button" onClick={() => setViewerZoom((value) => Math.min(4, value + .25))} aria-label="Zoom in"><Plus /></button></> : null}{renderFavourite(selectedFile)}{onAttach ? <button type="button" onClick={() => void attachItem(selectedFile)}>Add to Chat</button> : null}<a href={contentUrl(selectedFile, true)}><Download />Download</a><button type="button" onClick={() => setSelectedFile(null)} aria-label="Close viewer"><X /></button></span></header>
        {selectedFile.category === "image" ? <div className="library-image-viewer-stage"><button type="button" className="is-previous" onClick={() => navigateImage(-1)} aria-label="Previous image"><ChevronLeft /></button><img src={contentUrl(selectedFile)} alt={selectedFile.name} style={{ transform: `scale(${viewerZoom})` }} onDoubleClick={() => setViewerZoom((value) => value === 1 ? 2 : 1)} /><button type="button" className="is-next" onClick={() => navigateImage(1)} aria-label="Next image"><ChevronRight /></button></div> : previewable(selectedFile) ? <iframe title={selectedFile.name} src={contentUrl(selectedFile)} /> : <div className="personal-library-unavailable"><FileText /><h2>Preview is not available for this file type</h2><p>The original remains private. Download it and open it with Word, Excel, PowerPoint, or another compatible application.</p><a href={contentUrl(selectedFile, true)}>Download and open</a></div>}
      </div> : null}
      {settingsOpen ? <LibrarySettingsPanel preferences={preferences} storage={storage} folders={folders} authFetch={authFetch} formatBytes={formatBytes} onClose={() => setSettingsOpen(false)} onSaved={setNotice} onError={setError} onSettingsChange={setPreferences} onManageStorage={() => { setSettingsOpen(false); setStorageDialogOpen(true); }} onReload={() => loadCatalog()} /> : null}
    </section>
  );
}
