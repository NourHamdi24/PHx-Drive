import styles from "./Activity.module.css";

const formatRelativeTime = (date) => {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} d ago`;
};

const formatLastSynced = (date) => {
  const d = date.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const t = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${d} ${t}`;
};

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8 17 12 21 16 17" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
  </svg>
);

const ConflictIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <line x1="6" y1="9" x2="6" y2="21" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const BigCheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SyncingIcon = () => (
  <svg className={styles.spinning} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TYPE_CONFIG = {
  upload:   { Icon: UploadIcon,   bg: "#FFF8E7", color: "#F59E0B" },
  download: { Icon: DownloadIcon, bg: "#EFF6FF", color: "#3B82F6" },
  conflict: { Icon: ConflictIcon, bg: "#FFF1F2", color: "#F43F5E" },
  delete:   { Icon: DeleteIcon,   bg: "#F3F4F6", color: "#6B7280" },
  folder:   { Icon: FolderIcon,   bg: "#FFFBEB", color: "#D97706" },
  info:     { Icon: CheckIcon,    bg: "#F0FDF4", color: "#22C55E" },
  error:    { Icon: ErrorIcon,    bg: "#FFF1F2", color: "#EF4444" },
};

const Activity = ({ logs, onClear, syncing, lastSyncTime }) => {
  return (
    <div className={styles.container}>
      <div className={styles.statusCard}>
        <div
          className={styles.statusIcon}
          style={{
            background: syncing ? "#EFF6FF" : "#F0FDF4",
            color: syncing ? "#3B82F6" : "#22C55E",
          }}
        >
          {syncing ? <SyncingIcon /> : <BigCheckIcon />}
        </div>
        <div className={styles.statusText}>
          <span className={styles.statusTitle}>
            {syncing ? "Syncing…" : "All files up to date"}
          </span>
          {lastSyncTime && !syncing && (
            <span className={styles.statusSub}>
              <ClockIcon />
              Last synced {formatLastSynced(lastSyncTime)}
            </span>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Recent Activity</span>
          {logs.length > 0 && (
            <button className={styles.clearBtn} onClick={onClear}>
              Clear
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className={styles.emptyCard}>
            <span className={styles.empty}>No activity yet</span>
          </div>
        ) : (
          <div className={styles.activityCard}>
            {logs.map((log, i) => {
              const config = TYPE_CONFIG[log.type] || TYPE_CONFIG.info;
              const { Icon } = config;
              return (
                <div key={log.id ?? i} className={styles.activityItem}>
                  <div
                    className={styles.activityIcon}
                    style={{ background: config.bg, color: config.color }}
                  >
                    <Icon />
                  </div>
                  <div className={styles.activityBody}>
                    {log.fileName && (
                      <span className={styles.activityFileName}>{log.fileName}</span>
                    )}
                    <span className={log.fileName ? styles.activityLabel : styles.activityLabelOnly}>
                      {log.label}
                    </span>
                  </div>
                  <span className={styles.activityTime}>
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Activity;
