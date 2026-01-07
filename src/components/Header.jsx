import Link from "next/link";

export function Header() {
    return (
        <header>
            <div className="container">
                <Link href="/" className="logo">Поток 96</Link>

                <nav className="nav">
                    <Link href="/news">Новости</Link>
                    <Link href="/events">Афиша</Link>
                    <Link href="/about">О проекте</Link>
                </nav>
            </div>
        </header>
    );
}
