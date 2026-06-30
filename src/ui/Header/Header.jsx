import styles from "./Header.module.css";

const Header = ({ title, subtitle }) => {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </div>
  );
};

export default Header;
