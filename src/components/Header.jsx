import Link from "next/link";

export default function Header() {
    return (
        <header className="site-header">
            <div className="site-header-inner">
                <Link href="/" className="site-logo">
                    <span className="site-logo-title">Поток 96</span>
                    <span className="site-logo-subtitle">Красноуфимск и район</span>
                </Link>

                <nav className="site-nav" aria-label="Основная навигация">
                    <Link href="/news">Новости</Link>
                    <Link href="/events">Афиша</Link>
                    <Link href="/orgs">Справочник</Link>
                    <Link href="/about">О проекте</Link>
                </nav>
            </div>
        </header>
    );
}