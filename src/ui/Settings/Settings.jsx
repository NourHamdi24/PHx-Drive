import { useState, useEffect } from "react";
import styles from "./Settings.module.css";

const Settings = ({ user }) => {
  const [syncFolder, setSyncFolder] = useState(user?.sync_folder_path || "");
  const [syncMode, setSyncMode] = useState(user?.sync_mode || "manual");
  const [syncInterval, setSyncInterval] = useState(user?.sync_interval || 30);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleBrowse = async () => {
    const path = await window.api.selectFolder();
    if (path) setSyncFolder(path);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.api.saveSettings({
        sync_folder_path: syncFolder,
        sync_mode: syncMode,
        sync_interval: syncInterval,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Settings</h3>

      {/* Sync Folder */}
      <div className={styles.section}>
        <label className={styles.label}>Local Sync Folder</label>
        <p className={styles.description}>
          Files will be synced to and from this folder on your computer.
        </p>
        <div className={styles.folderRow}>
          <span className={styles.folderPath}>
            {syncFolder || "No folder selected"}
          </span>
          <button className={styles.browseBtn} onClick={handleBrowse}>
            Change
          </button>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Sync Mode */}
      <div className={styles.section}>
        <label className={styles.label}>Sync Mode</label>
        <p className={styles.description}>
          Manual mode only syncs when you click Sync Now. Auto mode syncs in the
          background.
        </p>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              value="manual"
              checked={syncMode === "manual"}
              onChange={() => setSyncMode("manual")}
            />
            <span>Manual — sync only when I click Sync Now</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              value="auto"
              checked={syncMode === "auto"}
              onChange={() => setSyncMode("auto")}
            />
            <span>Auto — sync automatically in the background</span>
          </label>
        </div>
      </div>

      {syncMode === "auto" && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <label className={styles.label}>Auto Sync Interval</label>
            <p className={styles.description}>
              How often to check for remote changes (in seconds).
            </p>
            <div className={styles.intervalRow}>
              <span className={styles.intervalLabel}>Every</span>
              <input
                type="number"
                className={styles.intervalInput}
                value={syncInterval}
                onChange={(e) => setSyncInterval(Number(e.target.value))}
                min={10}
                max={3600}
              />
              <span className={styles.intervalLabel}>seconds</span>
            </div>
          </div>
        </>
      )}

      <div className={styles.divider} />

      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saved ? "Saved ✅" : saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
};

export default Settings;
