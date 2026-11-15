import Link from "next/link";
import { getAllNews } from "@/lib/news";
import { getAllEvents } from "@/lib/events";
import { getAllOrgs } from "@/lib/orgs";
import { getAllAds } from "@/lib/ads";
import { getAllOfficialNotices } from "@/lib/officialNotices";
import { getAllOfficialDocumentsHybrid } from "@/lib/officialDocumentsHybrid";
import { getAllAlerts } from "@/lib/alerts";
import { SEARCH_SECTIONS, searchPublicContent, searchQuery, searchSection } from "@/lib/siteSearch.mjs";
import styles from "./search.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
    title: "Поиск по порталу",
    description: "Поиск новостей, мероприятий, организаций, объявлений и официальной информации на Поток 96.",
    robots: { index: false, follow: true },
};

function href(query, section = "") {
    const params = new URLSearchParams({ q: query });
    if (section) params.set("type", section);
    return `/search?${params.toString()}`;
}

export default async function SearchPage({ searchParams }) {
    const params = await searchParams;
    const query = searchQuery(params?.q);
    const section = searchSection(params?.type);
    let found = { query, section, total: 0, results: [], counts: {} };
    if (query.normalize("NFKC").trim().length >= 2) {
        const [news, events, orgs, ads, notices, documents, alerts] = await Promise.all([
            getAllNews(), getAllEvents(), getAllOrgs(), getAllAds(),
            getAllOfficialNotices(), getAllOfficialDocumentsHybrid(), getAllAlerts(),
        ]);
        found = searchPublicContent({ news, events, orgs, ads, notices, documents, alerts }, query, section);
    }
    const ready = query.normalize("NFKC").trim().length >= 2;
    return <main className={styles.page}>
        <header className={styles.heading}>
            <p className={styles.kicker}>Поток 96 / Найти на сайте</p>
            <h1>Поиск по порталу</h1>
            <p>Новости, афиша, организации, объявления и официальная информация Красноуфимска и района.</p>
        </header>
        <form action="/search" method="get" className={styles.searchForm} role="search">
            <label htmlFor="site-search">Поисковый запрос</label>
            <div className={styles.searchRow}>
                <input id="site-search" name="q" type="search" autoComplete="off"
                    maxLength={120} minLength={2} defaultValue={query}
                    placeholder="Название, адрес, номер документа…" required />
                {section && <input type="hidden" name="type" value={section} />}
                <button type="submit">Найти</button>
            </div>
        </form>
        {ready ? <>
            <nav className={styles.filters} aria-label="Разделы поиска">
                <Link href={href(query)} aria-current={!section ? "page" : undefined}>
                    Все разделы <span>{Object.values(found.counts).reduce((a,b)=>a+b,0)}</span>
                </Link>
                {SEARCH_SECTIONS.map(item => <Link key={item.id}
                    href={href(query, item.id)} aria-current={section === item.id ? "page" : undefined}>
                    {item.title} <span>{found.counts[item.id] ?? 0}</span>
                </Link>)}
            </nav>
            <div className={styles.summary} role="status">
                <h2>{found.total ? `Найдено: ${found.total}` : "Совпадений не найдено"}</h2>
                {found.total > found.results.length && <p>Показаны первые {found.results.length} результатов. Уточните запрос или выберите раздел.</p>}
                {!found.total && <p>Попробуйте другое слово, адрес или номер документа.</p>}
            </div>
            {found.results.length > 0 && <div className={styles.results}>
                {found.results.map((result, index) => <article key={`${result.type}:${result.url}:${index}`} className={styles.result}>
                    <p className={styles.category}>{SEARCH_SECTIONS.find(item => item.id === result.type)?.title}</p>
                    <h3><Link href={result.url}>{result.title}</Link></h3>
                    {result.description && <p className={styles.description}>{result.description}</p>}
                    {result.detail && <p className={styles.detail}>{result.detail}</p>}
                </article>)}
            </div>}
        </> : <p className={styles.empty}>Введите минимум два символа, чтобы найти материалы портала.</p>}
    </main>;
}
