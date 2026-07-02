import styles from "./Sidebar.module.css";

const FilesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 3a1 1 0 011-1h3.586a1 1 0 01.707.293L8.707 3.707A1 1 0 019.414 4H13a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" fill="currentColor" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <polyline points="1,8 4,4 7,10 10,6 13,8 15,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);


const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const TABS = [
  { id: "files", label: "Files", Icon: FilesIcon },
  { id: "activity", label: "Activity", Icon: ActivityIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

const Sidebar = ({ activeTab, onTabChange, disabledTabs = [] }) => {
  return (
    <div className={styles.sidebar}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.logo}>Px</div>
        <div className={styles.brandText}>
          <div className={styles.brandTitle}>PHx Drive</div>
          <div className={styles.brandSubtitle}>PharaonX · No Limitations</div>
        </div>
      </div>

      {/* Nav */}
      <div className={styles.menuLabel}>MENU</div>
      <nav className={styles.nav}>
        {TABS.map(({ id, label, Icon }) => {
          const disabled = disabledTabs.includes(id);
          return (
            <button
              key={id}
              className={`${styles.navItem} ${activeTab === id ? styles.active : ""}`}
              onClick={() => !disabled && onTabChange(id)}
              disabled={disabled}
              title={disabled ? "Finish setup in Settings first" : undefined}
            >
              <span className={styles.navIcon}>
                <Icon />
              </span>
              <span className={styles.navLabel}>{label}</span>
              {activeTab === id && <span className={styles.chevron}>›</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
