"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./MobileMenu.module.css";

export default function MobileMenu() {
    const pathname = usePathname();
    const isMenuPage = pathname === "/menu";

    return (
        <Link
            href={isMenuPage ? "/" : "/menu"}
            className={`${styles.button} ${isMenuPage ? styles.close : ""}`}
            aria-label={isMenuPage ? "Закрыть меню" : "Открыть меню"}
        >
            <span />
            <span />
            <span />
        </Link>
    );
}