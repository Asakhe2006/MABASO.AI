import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, File, FileAudio, FileImage, FileSpreadsheet, FileText, FolderOpen, LoaderCircle, Search, Trash2, UploadCloud, X } from "lucide-react";

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

export default function PersonalLibrary({ apiBaseUrl, authFetch, picker = false, onAttach, onClose }) {
  const [files, setFiles] = useState([]);
  const [storage, setStorage] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [attachingId, setAttachingId] = useState("");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [nextBefore, setNextBefore] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const inputRef = useRef(null);

  const loadFiles = useCallback(async ({ append = false, before = "" } = {}) => {
    if (!append) setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (query.trim()) params.set("search", query.trim());
      if (category) params.set("category", category);
      if (before) params.set("before", before);
      const response = await authFetch(`/api/library/files?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not load your Library.");
      const rows = Array.isArray(data.files) ? data.files : [];
      setFiles((current) => append ? [...current, ...rows.filter((row) => !current.some((item) => item.id === row.id))] : rows);
      setStorage(data.storage || null);
      setNextBefore(data.next_before || "");
      setHasMore(Boolean(data.has_more));
    } catch (requestError) {
      setError(requestError.message || "Could not load your Library.");
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, category, query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadFiles(), query ? 240 : 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadFiles, query]);

  const uploadFiles = async (selected) => {
    const chosen = Array.from(selected || []);
    if (!chosen.length) return;
    setIsUploading(true);
    setError("");
    try {
      for (const file of chosen) {
        const body = new FormData();
        body.append("file", file);
        const response = await authFetch("/api/library/files", { method: "POST", body, timeoutMs: 120000 });
        const data = await response.json().catch(() => ({}));
        const detail = data.detail && typeof data.detail === "object" ? data.detail.message : data.detail;
        if (!response.ok) throw new Error(detail || `Could not save ${file.name}.`);
      }
      await loadFiles();
    } catch (uploadError) {
      setError(uploadError.message || "The file could not be uploaded.");
    } finally {
      setIsUploading(false);
    }
  };

  const attachFile = async (file) => {
    if (!onAttach) return;
    setAttachingId(file.id);
    setError("");
    try {
      const response = await authFetch(`/api/library/files/${encodeURIComponent(file.id)}/attach`, { method: "POST", timeoutMs: 120000 });
      const data = await response.json().catch(() => ({}));
      const detail = data.detail && typeof data.detail === "object" ? data.detail.message : data.detail;
      if (!response.ok) throw new Error(detail || "This Library file could not be attached.");
      onAttach({
        id: `library-${file.id}`,
        libraryFileId: file.id,
        name: file.name,
        type: file.content_type,
        kind: (data.image_urls || []).length ? "image" : "document",
        dataUrl: (data.image_urls || []).find(Boolean) || "",
        text: String(data.text || "").trim(),
        receipt: String(data.upload_receipt || ""),
      });
      onClose?.();
    } catch (attachError) {
      setError(attachError.message || "This Library file could not be attached.");
    } finally {
      setAttachingId("");
    }
  };

  const deleteFile = async (file) => {
    if (!window.confirm(`Delete ${file.name} from your Library? Existing Study Workspaces will not be deleted.`)) return;
    setError("");
    const response = await authFetch(`/api/library/files/${encodeURIComponent(file.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.detail || "The file could not be deleted.");
      return;
    }
    setFiles((current) => current.filter((item) => item.id !== file.id));
    setStorage(data.storage || storage);
  };

  const usagePercent = useMemo(() => {
    if (!storage?.limit_bytes) return 0;
    return Math.min(100, Math.round((Number(storage.used_bytes || 0) / Number(storage.limit_bytes)) * 100));
  }, [storage]);

  const contentUrl = (file, download = false) => `${apiBaseUrl}/api/library/files/${encodeURIComponent(file.id)}/content${download ? "?download=true" : ""}`;
  const previewable = (file) => file.content_type === "application/pdf" || file.content_type?.startsWith("image/") || file.content_type?.startsWith("audio/") || file.content_type?.startsWith("text/");

  return (
    <section className={`personal-library ${picker ? "is-picker" : ""}`} aria-label={picker ? "Choose from Library" : "Library"}>
      <header className="personal-library-header">
        <div>
          {picker ? <button type="button" className="personal-library-back" onClick={onClose}><ArrowLeft aria-hidden="true" />Back to chat</button> : null}
          <p className="personal-library-eyebrow">Personal files</p>
          <h1>{picker ? "Add from Library" : "Library"}</h1>
          <p>Your uploaded study files, recordings and transcripts, all in one place.</p>
        </div>
        {picker ? <button type="button" className="personal-library-close" onClick={onClose} aria-label="Close Library"><X aria-hidden="true" /></button> : <FolderOpen className="personal-library-heading-icon" aria-hidden="true" />}
      </header>

      <div className="personal-library-toolbar">
        <label><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your files…" aria-label="Search Library files" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter Library files">
          <option value="">All files</option><option value="document">Documents</option><option value="presentation">Presentations</option><option value="spreadsheet">Spreadsheets</option><option value="image">Images</option><option value="audio">Audio</option><option value="note">Notes</option>
        </select>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading || !storage?.storage_configured}><UploadCloud aria-hidden="true" />{isUploading ? "Uploading…" : "Upload files"}</button>
        <input ref={inputRef} type="file" multiple accept="image/*,audio/*,.pdf,.docx,.pptx,.xlsx,.csv,.tsv,.txt,.md,.json,.xml,.html,.htm,.rtf,.odt,.ods,.odp" className="hidden" onChange={(event) => { void uploadFiles(event.target.files); event.target.value = ""; }} />
      </div>

      {error ? <div className="personal-library-error" role="alert">{error}<button type="button" onClick={() => void loadFiles()}>Retry</button></div> : null}
      {!storage?.storage_configured && !isLoading ? <div className="personal-library-notice">Private object storage is not configured yet. Existing Library metadata remains protected, but new uploads are paused.</div> : null}

      <div className="personal-library-list" aria-busy={isLoading}>
        {isLoading ? Array.from({ length: 5 }, (_, index) => <div className="personal-library-skeleton" key={index} />) : files.length ? files.map((file) => {
          const Icon = iconFor(file.category);
          return <article key={file.id} className="personal-library-row">
            <button type="button" className="personal-library-file-main" onClick={() => picker ? void attachFile(file) : setSelectedFile(file)} disabled={attachingId === file.id}>
              <Icon aria-hidden="true" />
              <span><strong>{file.name}</strong><small>{file.category} · {formatBytes(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString()}</small></span>
              {attachingId === file.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            </button>
            <div className="personal-library-row-actions">
              {!picker ? <button type="button" onClick={() => setSelectedFile(file)}>Preview</button> : null}
              <a href={contentUrl(file, true)} aria-label={`Download ${file.name}`}><Download aria-hidden="true" /></a>
              {!picker ? <button type="button" onClick={() => void deleteFile(file)} aria-label={`Delete ${file.name}`}><Trash2 aria-hidden="true" /></button> : null}
            </div>
          </article>;
        }) : <div className="personal-library-empty"><FolderOpen aria-hidden="true" /><h2>No Library files yet</h2><p>Upload a personal study source here, or add an accepted file from Study Chat.</p></div>}
      </div>
      {hasMore ? <button type="button" className="personal-library-load-more" onClick={() => void loadFiles({ append: true, before: nextBefore })}>Load older files</button> : null}

      {storage ? <button type="button" className="personal-library-storage" onClick={() => setError("Storage add-on checkout is not enabled until a verified payment-provider product is configured.")}>
        <span><strong>Storage</strong><small>{formatBytes(storage.used_bytes)} of {formatBytes(storage.limit_bytes)} used</small></span>
        <span className="personal-library-storage-track"><i style={{ width: `${usagePercent}%` }} /></span>
        <em>{formatBytes(storage.remaining_bytes)} remaining</em>
      </button> : null}

      {selectedFile ? <div className="personal-library-viewer" role="dialog" aria-modal="true" aria-label={`Preview ${selectedFile.name}`}>
        <header><button type="button" onClick={() => setSelectedFile(null)}><ArrowLeft aria-hidden="true" />Back to Library</button><strong>{selectedFile.name}</strong><a href={contentUrl(selectedFile, true)}><Download aria-hidden="true" />Download</a></header>
        {previewable(selectedFile) ? <iframe title={selectedFile.name} src={contentUrl(selectedFile)} /> : <div className="personal-library-unavailable"><FileText aria-hidden="true" /><h2>Preview is not available for this file type</h2><p>The original file remains private. Download it and open it with the appropriate Word, Excel, or PowerPoint application.</p><a href={contentUrl(selectedFile, true)}>Download and open</a></div>}
      </div> : null}
    </section>
  );
}
