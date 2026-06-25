import styles from "./App.module.css";
import { useState, useEffect } from "react";
import Login from "./Login/Login";
import Home from "./Home/Home";

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // On app start check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await window.api.autoLogin();
        if (result.success) {
          setUser(result);
        }
      } catch (err) {
        console.log("Auto login failed:", err);
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (result) => {
    setUser(result);
  };

  const handleLogout = async () => {
    await window.api.logout();
    setUser(null);
  };

  // Still checking auto login
  if (checking) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#0f0f0f",
          color: "#888",
          fontSize: "16px",
        }}
      >
        Loading...
      </div>
    );
  }
  return (
    <main className={styles.container}>
      {user ? (
        <Home user={user} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </main>
  );
}

export default App;
