import { useState, useEffect } from "react";
import styles from "./Home.module.css";
import Sidebar from "../Sidebar/Sidebar";
import Files from "../Files/Files";
import Activity from "../Activity/Activity";
import Settings from "../Settings/Settings";
import Header from "../Header/Header";

const PAGE_META = {
  files:    { title: "Files",    subtitle: "Your synced files" },
  activity: { title: "Sync Activity", subtitle: "Live feed of sync events" },
  settings: { title: "Settings", subtitle: "Manage your sync preferences" },
};

const parseLogMessage = (message) => {
  if (/^Uploading:\s*/i.test(message))
    return { type: "upload", fileName: message.replace(/^Uploading:\s*/i, "").trim(), label: "Uploading to cloud" };
  if (/^Uploaded:\s*/.test(message))
    return { type: "upload", fileName: message.replace(/^Uploaded:\s*/, "").replace(/\s*✅\s*$/, "").trim(), label: "Uploaded to cloud" };
  if (/^Updating:\s*/i.test(message))
    return { type: "upload", fileName: message.replace(/^Updating:\s*/i, "").trim(), label: "Syncing to cloud" };
  if (/^Updated:\s*/.test(message))
    return { type: "upload", fileName: message.replace(/^Updated:\s*/, "").replace(/\s*✅\s*$/, "").trim(), label: "Synced to cloud" };
  if (/^Upload failed:\s*/.test(message))
    return { type: "error", fileName: message.replace(/^Upload failed:\s*/, "").replace(/\s*❌\s*$/, "").trim(), label: "Upload failed" };
  if (/^Update failed:\s*/.test(message))
    return { type: "error", fileName: message.replace(/^Update failed:\s*/, "").replace(/\s*❌\s*$/, "").trim(), label: "Sync failed" };

  if (/^Downloading:\s*/i.test(message))
    return { type: "download", fileName: message.replace(/^Downloading:\s*/i, "").trim(), label: "Downloading from cloud" };
  if (/^Downloaded:\s*/.test(message))
    return { type: "download", fileName: message.replace(/^Downloaded:\s*/, "").replace(/\s*✅\s*$/, "").trim(), label: "Downloaded from cloud" };

  if (/^Deleting:\s*/i.test(message))
    return { type: "delete", fileName: message.replace(/^Deleting:\s*/i, "").trim(), label: "Deleting" };
  if (/^Deleted:\s*/.test(message))
    return { type: "delete", fileName: message.replace(/^Deleted:\s*/, "").replace(/\s*✅\s*$/, "").trim(), label: "Deleted" };
  if (/^Delete failed:\s*/.test(message))
    return { type: "error", fileName: message.replace(/^Delete failed:\s*/, "").replace(/\s*❌\s*$/, "").trim(), label: "Delete failed" };

  if (/^Creating folder:\s*/i.test(message))
    return { type: "folder", fileName: message.replace(/^Creating folder:\s*/i, "").trim(), label: "Creating folder" };
  if (/^Folder created:\s*/.test(message))
    return { type: "folder", fileName: message.replace(/^Folder created:\s*/, "").replace(/\s*✅\s*$/, "").trim(), label: "Folder created" };
  if (/^Folder creation failed:\s*/.test(message))
    return { type: "error", fileName: message.replace(/^Folder creation failed:\s*/, "").replace(/\s*❌\s*$/, "").trim(), label: "Folder creation failed" };

  if (/conflict/i.test(message))
    return { type: "conflict", fileName: null, label: "Conflict — both copies kept" };
  if (/Sync complete/i.test(message))
    return { type: "info", fileName: null, label: "All files synced" };
  if (/Sync failed/i.test(message))
    return { type: "error", fileName: null, label: "Sync failed" };
  if (/Sync started/i.test(message))
    return { type: "info", fileName: null, label: "Sync started" };

  return { type: "info", fileName: null, label: message };
};

const Home = ({ user, onLogout }) => {
  const [syncFolderPath, setSyncFolderPath] = useState(user?.sync_folder_path || "");
  const needsSetup = !syncFolderPath;
  const [activeTab, setActiveTab] = useState(needsSetup ? "settings" : "files");
  const [syncLog, setSyncLog] = useState([]);
  const [files, setFiles] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const addLog = (message) => {
    const parsed = parseLogMessage(message);
    setSyncLog((prev) =>
      [{ ...parsed, timestamp: new Date(), id: Date.now() + Math.random() }, ...prev].slice(0, 50),
    );
  };

  const loadFiles = async () => {
    try {
      const result = await window.api.listFilesWithStatus();
      setFiles(result);
    } catch (err) {
      console.error("Failed to load files:", err);
    }
  };


  const handleSync = async () => {
    setSyncing(true);
    addLog("Sync started...");
    try {
      await window.api.runSync();
      addLog("Sync complete ✅");
      setLastSyncTime(new Date());
      await loadFiles();
    } catch (err) {
      addLog("Sync failed ❌");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadFiles();
    const offLog = window.api.onSyncLog((message) => addLog(message));
    const offRefresh = window.api.onSyncRefresh(() => loadFiles());
    return () => {
      offLog?.();
      offRefresh?.();
    };
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "files":
        return (
          <Files
            files={files}
            onRefresh={loadFiles}
            syncing={syncing}
            onSync={handleSync}
          />
        );
      case "activity":
        return <Activity logs={syncLog} onClear={() => setSyncLog([])} syncing={syncing} lastSyncTime={lastSyncTime} />;
      case "settings":
        return (
          <Settings
            user={user}
            onLogout={onLogout}
            onSaved={(saved) => setSyncFolderPath(saved.sync_folder_path || "")}
          />
        );
      default:
        return (
          <Files
            files={files}
            onRefresh={loadFiles}
            syncing={syncing}
            onSync={handleSync}
          />
        );
    }
  };

  const page = PAGE_META[activeTab] || PAGE_META.files;

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          disabledTabs={needsSetup ? ["files", "activity"] : []}
        />
        <div className={styles.main}>
          <Header
            title={page.title}
            subtitle={page.subtitle}
          />
          <div className={styles.content}>{renderTab()}</div>
        </div>
      </div>
    </div>
  );
};

export default Home;
