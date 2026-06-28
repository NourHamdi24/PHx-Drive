import styles from "./Activity.module.css";

const Activity = ({ logs, onClear }) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Sync Activity</h3>
        <button className={styles.clearBtn} onClick={onClear}>
          Clear
        </button>
      </div>
      <div className={styles.logList}>
        {logs.length === 0 ? (
          <p className={styles.empty}>No activity yet</p>
        ) : (
          logs.map((log, i) => (
            <p key={i} className={styles.logItem}>
              {log}
            </p>
          ))
        )}
      </div>
    </div>
  );
};

export default Activity;
