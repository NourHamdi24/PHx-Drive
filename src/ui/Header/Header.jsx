import styles from "./Header.module.css";

const Header = ({ user, onLogout, onSync, syncing }) => {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>Px</span>
        <span className={styles.title}>PHx Drive</span>
      </div>
      <div className={styles.right}>
        <span className={styles.email}>{user?.email}</span>
        <button className={styles.syncBtn} onClick={onSync} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
        <button className={styles.logoutBtn} onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Header;
