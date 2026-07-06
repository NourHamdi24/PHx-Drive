import styles from "./App.module.css";
import { useState, useEffect } from "react";
import Login from "./Login/Login";
import Home from "./Home/Home";
import Guide from "./Guide/Guide";

const GUIDE_SEEN_KEY = "phx_drive_guide_seen";
function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("loading");
  // On app start check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await window.api.autoLogin();
        if (result.success) {
          setUser(result);
          await window.api.startWatcher();
          await window.api.startPolling();
          setScreen("home");
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
    await window.api.startPolling();
    const seenGuide = localStorage.getItem(GUIDE_SEEN_KEY);
    setScreen(seenGuide ? "home" : "guide");
  };

  const handleGuideContinue = () => {
    localStorage.setItem(GUIDE_SEEN_KEY, "true");
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
  if (screen === "guide") return <Guide onContinue={handleGuideContinue} />;
  if (screen === "home") return <Home user={user} onLogout={handleLogout} />;
}

export default App;
