import React, { useState } from "react";
import styles from "./Login.module.css";

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await window.api.login(email, password);
      if (result.success) {
        onLoginSuccess(result);
      } else {
        setError("Login failed. Check your credentials.");
      }
    } catch (err) {
      setError("Could not connect to Frappe. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.login}>
      <div className={styles.loginCard}>
        <div className={styles.loginContent}>
          <div className={styles.logo}>
            <h1>Px</h1>
          </div>
          <div className={styles.title}>
            <h1>PharaonX</h1>
            <h2>no limitations</h2>
          </div>
          <div className={styles.subtitle}>
            <p>Sign in to</p>
            <span>PHx Drive</span>
          </div>
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@pharaonx.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin(e)}
                disabled={loading}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className={loading ? styles.buttonDisabled : styles.loginBtn}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} PharaonX. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
