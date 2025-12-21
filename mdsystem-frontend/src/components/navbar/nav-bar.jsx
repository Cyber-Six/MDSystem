import styles from './NavBar.module.css';

const NavBar = () => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.navContent}>
        <div className={styles.navLogo}>
          <span className={styles.logoIcon}>🏥</span>
          <span className={styles.logoText}>MDSystem</span>
        </div>
        <div className={styles.navLinks}>
          {/* Navigation links will go here */}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
