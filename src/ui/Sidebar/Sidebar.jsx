import styles from "./Sidebar.module.css";

const tabs = [
  { id: "files", label: "Files", icon: "📁" },
  { id: "activity", label: "Activity", icon: "📋" },
  { id: "conflicts", label: "Conflicts", icon: "⚠️" },
  { id: "trash", label: "Trash", icon: "🗑️" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

const Sidebar = ({ activeTab, onTabChange }) => {
  return (
    <div className={styles.sidebar}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {/* <span className={styles.icon}>{tab.icon}</span> */}
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default Sidebar;
