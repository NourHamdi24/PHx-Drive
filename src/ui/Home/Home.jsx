import { useState, useEffect } from "react";
import styles from "./Home.module.css";
import Sidebar from "../Sidebar/Sidebar";
import Files from "../Files/Files";
import Activity from "../Activity/Activity";
import Conflicts from "../Conflicts/Conflicts";
import Trash from "../Trash/Trash";
import Settings from "../Settings/Settings";
import Header from "../Header/Header";

const Home = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState("files");
  const [syncLog, setSyncLog] = useState([]);
  const [files, setFiles] = useState([]);
  const [syncing, setSyncing] = useState(false);

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
      console.error("Failed to load files:", err);
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
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadFiles();
    window.api.onSyncLog((message) => addLog(message));
    window.api.onSyncRefresh(() => loadFiles());
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "files":
        return <Files files={files} onRefresh={loadFiles} />;
      case "activity":
        return <Activity logs={syncLog} onClear={() => setSyncLog([])} />;
      case "conflicts":
        return <Conflicts />;
      case "trash":
        return <Trash />;
      case "settings":
        return <Settings user={user} />;
      default:
        return <Files files={files} onRefresh={loadFiles} />;
    }
  };

  return (
    <div className={styles.container}>
      <Header
        user={user}
        onLogout={onLogout}
        onSync={handleSync}
        syncing={syncing}
      />
      <div className={styles.body}>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className={styles.content}>{renderTab()}</div>
      </div>
    </div>
  );
};

export default Home;
