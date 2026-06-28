import { useState, useEffect } from "react";
import styles from "./Home.module.css";
const FileItem = ({ file }) => {
  const icon = file.is_group ? "📁" : "📄";
  const size = file.file_size
    ? `${(file.file_size / 1024).toFixed(1)} KB`
    : "—";
  const modified = new Date(file.modified).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className={styles.fileRow}>
      <span className={styles.fileIcon}>{icon}</span>
      <span className={styles.fileName}>{file.title}</span>
      <span className={styles.fileMeta}>{size}</span>
      <span className={styles.fileMeta}>{modified}</span>

      <button
        className={styles.shareBtn}
        onClick={() => {
          navigator.clipboard.writeText(window.api.getShareLink(file.name));
          alert("Link copied!");
        }}
      >
        Share
      </button>
    </div>
  );
};

const Home = ({ user, onLogout }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState([]);
  const [error, setError] = useState("");

  const addLog = (message) => {
    setSyncLog((prev) =>
      [`${new Date().toLocaleTimeString()} — ${message}`, ...prev].slice(0, 50),
    );
  };

  const loadFiles = async () => {
    try {
      const result = await window.api.listFiles();
      setFiles(result);
    } catch (err) {
      setError("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    addLog("Sync started...");
    try {
      await window.api.runSync();
      addLog("Sync complete ✅");
      await loadFiles();
    } catch (err) {
      addLog("Sync failed ❌");
      setError("Sync failed. Check your connection.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadFiles();
    window.api.onSyncLog((message) => addLog(message));
    window.api.onSyncRefresh(() => loadFiles());
  }, []);
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>PHx Drive</h2>

        <div className={styles.headerRight}>
          <span className={styles.email}>{user.email}</span>

          <button
            className={styles.syncBtn}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>

          <button className={styles.logoutBtn} onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* File Browser */}
        <div className={styles.filePanel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>My Files</h3>

            <span className={styles.fileCount}>{files.length} items</span>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {loading ? (
            <p className={styles.placeholder}>Loading files...</p>
          ) : files.length === 0 ? (
            <p className={styles.placeholder}>
              No files yet. Add files to your sync folder.
            </p>
          ) : (
            <div className={styles.fileList}>
              <div className={styles.fileHeader}>
                <span className={styles.fileHeaderName}>Name</span>
                <span className={styles.fileMeta}>Size</span>
                <span className={styles.fileMeta}>Modified</span>
                <span className={styles.fileMeta}>Share</span>
              </div>

              {files.map((file) => (
                <FileItem key={file.name} file={file} />
              ))}
            </div>
          )}
        </div>

        {/* Sync Log */}
        <div className={styles.logPanel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Sync Activity</h3>

            <button className={styles.clearBtn} onClick={() => setSyncLog([])}>
              Clear
            </button>
          </div>

          <div className={styles.logList}>
            {syncLog.length === 0 ? (
              <p className={styles.placeholder}>No activity yet.</p>
            ) : (
              syncLog.map((log, i) => (
                <p key={i} className={styles.logItem}>
                  {log}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
