import styles from "./Files.module.css";

const Files = ({ files, onRefresh }) => {
  const handleShare = async (entityName) => {
    const link = await window.api.getShareLink(entityName);
    navigator.clipboard.writeText(link);
    alert("Link copied to clipboard!");
  };

  if (!files || files.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No files yet</p>
        <p className={styles.emptySubtext}>
          Add files to your sync folder or upload via Frappe Drive
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableHeader}>
        <span className={styles.colName}>Name</span>
        <span className={styles.colMeta}>Size</span>
        <span className={styles.colMeta}>Modified</span>
        <span className={styles.colAction}>Share</span>
      </div>
      {files.map((file) => (
        <div key={file.name} className={styles.row}>
          <span className={styles.icon}>{file.is_group ? "📁" : "📄"}</span>
          <span className={styles.fileName}>{file.title}</span>
          <span className={styles.colMeta}>
            {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : "—"}
          </span>
          <span className={styles.colMeta}>
            {new Date(file.modified).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
          <button
            className={styles.shareBtn}
            onClick={() => handleShare(file.name)}
          >
            Copy Link
          </button>
        </div>
      ))}
    </div>
  );
};

export default Files;
