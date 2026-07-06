import styles from "./Guide.module.css";

const Guide = ({ onContinue }) => {
  const handleViewGuide = () => {
    window.api.openGuide();
    onContinue();
  };

  return (
    <div className={styles.guide}>
      <div className={styles.card}>
        <div className={styles.content}>
          <div className={styles.logo}>
            <h1>Px</h1>
          </div>
          <h1 className={styles.title}>Welcome to PHx Drive</h1>
          <p className={styles.subtitle}>
            New here? Take a quick look at the user guide to get started, or
            skip it and dive right in.
          </p>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={handleViewGuide}>
              View guide
            </button>
            <button className={styles.skipBtn} onClick={onContinue}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Guide;
