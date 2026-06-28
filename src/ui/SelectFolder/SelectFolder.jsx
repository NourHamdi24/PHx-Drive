import { useState } from "react";
import styles from "./SelectFolder.module.css";
const SelectFolder = ({ onFolderSelected }) => {
  const [selectedPath, setSelectedPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBrowse = async () => {
    const path = await window.api.selectFolder();
    if (path) setSelectedPath(path);
  };

  const handleConfirm = async () => {
    if (!selectedPath) {
      setError("Please select a folder first");
      return;
    }

    setLoading(true);
    try {
      const result = await window.api.saveSyncFolder(selectedPath);
      if (result.success) {
        onFolderSelected(selectedPath);
      }
    } catch (err) {
      setError("Failed to save folder. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Choose Sync Folder</h2>
        <p className={styles.subtitle}>
          PHx Drive will sync your files to this folder on your computer.
        </p>

        <div className={styles.pathRow}>
          <span className={styles.path}>
            {selectedPath || "No folder selected"}
          </span>
          <button className={styles.browseBtn} onClick={handleBrowse}>
            Browse
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={
            selectedPath ? styles.confirmBtn : styles.confirmBtnDisabled
          }
          onClick={handleConfirm}
          disabled={!selectedPath || loading}
        >
          {loading ? "Saving..." : "Start Syncing"}
        </button>
      </div>
    </div>
  );
};
export default SelectFolder;
