import { useState, useEffect } from "react";
import styles from "./Settings.module.css";
import { getStoredThemePreference, resolveTheme, setTheme } from "../theme";

const getInitials = (email = "") => {
  const local = email.split("@")[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.substring(0, 2).toUpperCase();
};

const FolderIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const SignOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const Settings = ({ user, onLogout, onSaved }) => {
  const [syncFolder, setSyncFolder] = useState(user?.sync_folder_path || "");
  const [syncMode, setSyncMode] = useState(user?.sync_mode || "manual");
  const [syncInterval, setSyncInterval] = useState(user?.sync_interval || 30);
  const [autoStart, setAutoStart] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => resolveTheme(getStoredThemePreference()) === "dark",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const load = async () => {
      const fresh = await window.api.getUserSettings();
      setSyncFolder(fresh.sync_folder_path || "");
      setSyncMode(fresh.sync_mode || "manual");
      setSyncInterval(fresh.sync_interval || 30);
      const isAutoStart = await window.api.getAutoStart();
      setAutoStart(isAutoStart);
      const userProfile = await window.api.getUserProfile();
      setProfile(userProfile);
    };
    load();
  }, []);

  const handleOpenFrappe = () => {
    if (user?.frappe_url) window.api.openExternal(user.frappe_url);
  };

  const handleSave = async () => {
    if (!syncFolder) {
      setError("Please choose a sync folder first");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await window.api.saveSettings({
        sync_folder_path: syncFolder,
        sync_mode: syncMode,
        sync_interval: syncInterval,
      });
      await window.api.setAutoStart(autoStart);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.({ sync_folder_path: syncFolder, sync_mode: syncMode, sync_interval: syncInterval });
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleBrowse = async () => {
    const path = await window.api.selectFolder();
    if (path) setSyncFolder(path);
  };

  const handleToggleDarkMode = (checked) => {
    setDarkMode(checked);
    setTheme(checked ? "dark" : "light");
  };

  const initials = getInitials(user?.email);

  return (
    <div className={styles.container}>

      {/* ── Account ──────────────────────────────────────── */}
      <span className={styles.sectionLabel}>Account</span>
      <div className={styles.card}>
        <div className={styles.accountRow}>
          {profile?.image ? (
            <img className={styles.avatarImg} src={profile.image} alt="" />
          ) : (
            <div className={styles.avatar}>{initials}</div>
          )}
          <div className={styles.accountInfo}>
            {profile?.full_name && (
              <span className={styles.accountName}>{profile.full_name}</span>
            )}
            <span className={styles.accountEmail}>{user?.email || "—"}</span>
          </div>
          <button className={styles.openFrappeBtn} onClick={handleOpenFrappe}>
            <ExternalLinkIcon />
            Open in browser
          </button>
        </div>
      </div>

      {/* ── Sync Folder ──────────────────────────────────── */}
      <span className={styles.sectionLabel}>Sync folder</span>
      <div className={styles.card}>
        <div className={styles.folderRow}>
          <span className={styles.folderIcon}><FolderIcon /></span>
          <span className={styles.folderPath}>{syncFolder || "No folder selected"}</span>
          <button className={styles.browseBtn} onClick={handleBrowse}>Browse…</button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {/* ── Sync Mode ────────────────────────────────────── */}
      <span className={styles.sectionLabel}>Sync mode</span>
      <div className={styles.modeGroup}>
        <button
          className={`${styles.modeCard} ${syncMode === "manual" ? styles.modeCardActive : ""}`}
          onClick={() => setSyncMode("manual")}
        >
          <span className={`${styles.radio} ${syncMode === "manual" ? styles.radioActive : ""}`} />
          <div className={styles.modeBody}>
            <span className={styles.modeTitle}>
              Manual
              <span className={styles.defaultBadge}>Default</span>
            </span>
            <span className={styles.modeDesc}>Sync only when you press "Sync now". Best for metered connections.</span>
          </div>
        </button>

        <button
          className={`${styles.modeCard} ${syncMode === "auto" ? styles.modeCardActive : ""}`}
          onClick={() => setSyncMode("auto")}
        >
          <span className={`${styles.radio} ${syncMode === "auto" ? styles.radioActive : ""}`} />
          <div className={styles.modeBody}>
            <span className={styles.modeTitle}>Automatic</span>
            <span className={styles.modeDesc}>Files sync continuously in the background as they change.</span>
          </div>
        </button>
      </div>

      {/* ── Sync Interval (auto only) ─────────────────────── */}
      {syncMode === "auto" && (
        <>
          <span className={styles.sectionLabel}>Sync interval</span>
          <div className={styles.card}>
            <div className={styles.intervalRow}>
              <span className={styles.intervalText}>Check for remote changes every</span>
              <input
                type="number"
                className={styles.intervalInput}
                value={syncInterval}
                onChange={(e) => setSyncInterval(Number(e.target.value))}
                min={10}
                max={3600}
              />
              <span className={styles.intervalText}>seconds</span>
            </div>
          </div>
        </>
      )}

      {/* ── System ───────────────────────────────────────── */}
      <span className={styles.sectionLabel}>System</span>
      <div className={styles.card}>
        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <span className={styles.toggleTitle}>Open on startup</span>
            <span className={styles.toggleDesc}>Launch PHx Drive automatically when your computer starts.</span>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      {/* ── Appearance ───────────────────────────────────── */}
      <span className={styles.sectionLabel}>Appearance</span>
      <div className={styles.card}>
        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <span className={styles.toggleTitle}>Dark mode</span>
            <span className={styles.toggleDesc}>Follows your system setting by default. Toggle to override.</span>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => handleToggleDarkMode(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      {/* ── Save ─────────────────────────────────────────── */}
      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saved ? "Saved ✓" : saving ? "Saving…" : "Save changes"}
      </button>

      {/* ── Sign out ─────────────────────────────────────── */}
      <div className={styles.signOutCard}>
        <div className={styles.signOutInfo}>
          <span className={styles.signOutTitle}>Sign out of PHx Drive</span>
          <span className={styles.signOutDesc}>Your synced files will remain in the local folder.</span>
        </div>
        <button className={styles.signOutBtn} onClick={onLogout}>
          <SignOutIcon />
          Sign out
        </button>
      </div>

    </div>
  );
};

export default Settings;
