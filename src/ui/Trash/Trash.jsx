import { useState, useEffect } from "react";
import styles from "./Trash.module.css";

const Trash = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const loadTrash = async () => {
    try {
      const result = await window.api.listTrash();
      setItems(result);
    } catch (err) {
      console.error("Failed to load trash:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (entityName) => {
    setActing(entityName);
    try {
      await window.api.restoreFile(entityName);
      await loadTrash();
    } catch (err) {
      console.error("Restore failed:", err);
    } finally {
      setActing(null);
    }
  };

  const handlePermanentDelete = async (entityName) => {
    if (!confirm("Permanently delete this file? This cannot be undone."))
      return;
    setActing(entityName);
    try {
      await window.api.permanentDelete(entityName);
      await loadTrash();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setActing(null);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  if (loading) return <p className={styles.placeholder}>Loading trash...</p>;

  if (items.length === 0)
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>🗑️ Trash is empty</p>
        <p className={styles.emptySubtext}>Deleted files will appear here</p>
      </div>
    );

  return (
    <div className={styles.container}>
      <div className={styles.tableHeader}>
        <span className={styles.colName}>Name</span>
        <span className={styles.colMeta}>Deleted</span>
        <span className={styles.colMeta}>Expires</span>
        <span className={styles.colActions}>Actions</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className={styles.row}>
          <span className={styles.icon}>📄</span>
          <span className={styles.fileName}>{item.title}</span>
          <span className={styles.colMeta}>
            {item.deleted_at
              ? new Date(item.deleted_at).toLocaleDateString()
              : "—"}
          </span>
          <span className={styles.colMeta}>
            {item.expires_at
              ? new Date(item.expires_at).toLocaleDateString()
              : "—"}
          </span>
          <div className={styles.colActions}>
            <button
              className={styles.restoreBtn}
              onClick={() => handleRestore(item.entity_name)}
              disabled={acting === item.entity_name}
            >
              Restore
            </button>
            <button
              className={styles.deleteBtn}
              onClick={() => handlePermanentDelete(item.entity_name)}
              disabled={acting === item.entity_name}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Trash;
