import React from "react";
import styles from "./Home.module.css";

const Home = ({ user, onLogout }) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>PHx Drive</h2>
        <div className={styles.userInfo}>
          <span className={styles.email}>{user.email}</span>
          <button className={styles.logoutBtn} onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
      <div className={styles.body}>
        <p className={styles.placeholder}>
          ✅ Logged in successfully. Sync engine coming soon.
        </p>
      </div>
    </div>
  );
};

export default Home;
