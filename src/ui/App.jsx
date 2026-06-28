import styles from "./App.module.css";
import { useState, useEffect } from "react";
import Login from "./Login/Login";
import Home from "./Home/Home";
import SelectFolder from "./SelectFolder/SelectFolder";
function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("loading");
  // On app start check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await window.api.autoLogin();
        if (result.success) {
          if (result.success) {
            setUser(result);
            await window.api.startWatcher();
            setScreen(result.sync_folder_path ? "home" : "selectFolder");
          }
        } else {
          setScreen("login");
        }
      } catch (err) {
        setScreen("login");
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = async (result) => {
    setUser(result);
    await window.api.startWatcher();
    setScreen(result.sync_folder_path ? "home" : "selectFolder");
  };

  const handleFolderSelected = (folderPath) => {
    setUser((prev) => ({ ...prev, sync_folder_path: folderPath }));
    setScreen("home");
  };

  const handleLogout = async () => {
    await window.api.logout();
    setUser(null);
    setScreen("login");
  };
  // Still checking auto login
  if (screen === "loading") return <div>Loading...</div>;
  if (screen === "login") return <Login onLoginSuccess={handleLoginSuccess} />;
  if (screen === "selectFolder")
    return <SelectFolder onFolderSelected={handleFolderSelected} />;
  if (screen === "home") return <Home user={user} onLogout={handleLogout} />;
}

export default App;
