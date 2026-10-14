import Link from "next/link";

import styles from "./MobileMenu.module.css";

export default function MobileMenu() {
    return (
        <Link href="/menu" className={styles.button} aria-label="Открыть меню">
            <span />
            <span />
            <span />
        </Link>
    );
}