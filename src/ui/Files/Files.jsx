import { useState } from "react";
import styles from "./Files.module.css";

// ─── Helpers ───────────────────────────────────────────────

const formatSize = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
};

const FILE_TYPE_MAP = {
  pdf:  { label: "PDF", bg: "#fee2e2", color: "#dc2626" },
  zip:  { label: "ZIP", bg: "#ffedd5", color: "#ea580c" },
  rar:  { label: "ZIP", bg: "#ffedd5", color: "#ea580c" },
  "7z": { label: "ZIP", bg: "#ffedd5", color: "#ea580c" },
  xlsx: { label: "XLS", bg: "#dcfce7", color: "#16a34a" },
  xls:  { label: "XLS", bg: "#dcfce7", color: "#16a34a" },
  csv:  { label: "CSV", bg: "#dcfce7", color: "#16a34a" },
  docx: { label: "DOC", bg: "#fee2e2", color: "#dc2626" },
  doc:  { label: "DOC", bg: "#fee2e2", color: "#dc2626" },
  pptx: { label: "PPT", bg: "#ffedd5", color: "#ea580c" },
  ppt:  { label: "PPT", bg: "#ffedd5", color: "#ea580c" },
  txt:  { label: "TXT", bg: "#f3f4f6", color: "#6b7280" },
  md:   { label: "MD",  bg: "#f3f4f6", color: "#6b7280" },
  jpg:  { label: "IMG", bg: "#dbeafe", color: "#2563eb" },
  jpeg: { label: "IMG", bg: "#dbeafe", color: "#2563eb" },
  png:  { label: "IMG", bg: "#dbeafe", color: "#2563eb" },
  gif:  { label: "GIF", bg: "#dbeafe", color: "#2563eb" },
  webp: { label: "IMG", bg: "#dbeafe", color: "#2563eb" },
  mp4:  { label: "VID", bg: "#ede9fe", color: "#7c3aed" },
  mov:  { label: "VID", bg: "#ede9fe", color: "#7c3aed" },
  avi:  { label: "VID", bg: "#ede9fe", color: "#7c3aed" },
};

const FileIcon = ({ title, isGroup }) => {
  if (isGroup) {
    return (
      <div className={styles.fileIcon} style={{ background: "#fef3c7" }}>
        <span style={{ color: "#d97706", fontSize: 13 }}>📁</span>
      </div>
    );
  }
  const ext = title?.split(".").pop()?.toLowerCase() || "";
  const info = FILE_TYPE_MAP[ext] || { label: "FILE", bg: "#f3f4f6", color: "#6b7280" };
  return (
    <div className={styles.fileIcon} style={{ background: info.bg }}>
      <span style={{ color: info.color, fontSize: 9, fontWeight: 700, letterSpacing: "0.02em" }}>
        {info.label}
      </span>
    </div>
  );
};

const STATUS_CONFIG = {
  synced:         { label: "Synced",    icon: "✓",  bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  pending:        { label: "Pending",   icon: "○",  bg: "#f9fafb", color: "#9ca3af", border: "#e5e7eb" },
  remote_deleted: { label: "Not synced",icon: "↕",  bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  conflict:       { label: "Conflict",  icon: "⚠",  bg: "#fce7f3", color: "#dc2626", border: "#fbcfe8" },
  error:          { label: "Error",     icon: "!",  bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  syncing:        { label: "Syncing",   icon: "↻",  bg: "#fff7ed", color: "#ea580c", border: "#fed7aa", spin: true },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <div
      className={styles.statusBadge}
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
    >
      <span className={cfg.spin ? styles.spinIcon : styles.statusIcon}>
        {cfg.icon}
      </span>
      <span>{cfg.label}</span>
    </div>
  );
};

// ─── Icons ─────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke="#9ca3af" strokeWidth="2"/>
    <path d="M21 21l-4.35-4.35" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SyncIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Main component ─────────────────────────────────────────

const Files = ({ files, onRefresh, syncing, onSync }) => {
  const [search, setSearch] = useState("");
  const [trashing, setTrashing] = useState(null);

  const handleShare = async (entityName) => {
    const link = await window.api.getShareLink(entityName);
    navigator.clipboard.writeText(link);
    alert("Link copied to clipboard!");
  };

  const handleTrash = async (entityName) => {
    if (!confirm("Permanently delete this file? This cannot be undone.")) return;
    setTrashing(entityName);
    try {
      await window.api.trashFile(entityName);
      await onRefresh();
    } catch (err) {
      console.error("Trash failed:", err);
    } finally {
      setTrashing(null);
    }
  };

  const filtered = (files || []).filter((f) =>
    (f.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const isFileSyncing = (file) =>
    syncing && (file.syncStatus === "pending" || file.syncStatus === "syncing");

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <SearchIcon />
          <input
            className={styles.searchInput}
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.toolbarRight}>
          <button
            className={styles.syncBtn}
            onClick={onSync}
            disabled={syncing}
          >
            <span className={syncing ? styles.spinIcon : ""}>
              <SyncIcon />
            </span>
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.card}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              {search ? "No files match your search" : "No files yet"}
            </p>
            <p className={styles.emptySubtext}>
              {!search && "Add files to your sync folder or upload via Frappe Drive"}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.tableHeader}>
              <span className={styles.colName}>NAME</span>
              <span className={styles.colSize}>SIZE</span>
              <span className={styles.colDate}>MODIFIED</span>
              <span className={styles.colStatus}>STATUS</span>
              <span className={styles.colActions} />
            </div>

            {filtered.map((file) => (
              <div key={file.name} className={styles.row}>
                <div className={styles.colName}>
                  <FileIcon title={file.title} isGroup={file.is_group} />
                  <div className={styles.nameBlock}>
                    <span className={styles.fileName}>{file.title}</span>
                    {isFileSyncing(file) && (
                      <div className={styles.progressTrack}>
                        <div className={styles.progressBar} />
                      </div>
                    )}
                  </div>
                </div>
                <span className={styles.colSize}>
                  {formatSize(file.file_size)}
                </span>
                <span className={styles.colDate}>
                  {formatDate(file.modified)}
                </span>
                <span className={styles.colStatus}>
                  <StatusBadge
                    status={isFileSyncing(file) ? "syncing" : file.syncStatus}
                  />
                </span>
                <div className={styles.colActions}>
                  <button
                    className={styles.shareBtn}
                    onClick={() => handleShare(file.name)}
                    title="Copy share link"
                  >
                    Copy Link
                  </button>
                  <button
                    className={styles.trashBtn}
                    onClick={() => handleTrash(file.name)}
                    disabled={trashing === file.name}
                    title="Delete file"
                  >
                    {trashing === file.name ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default Files;
