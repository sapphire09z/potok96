import Link from "next/link";
import { getAllNews } from "@/lib/news";
import {getAllEvents} from "@/lib/events";
import styles from "./home.module.css";

export const metadata = {
  title: "Поток 96",
  description: "Новости, афиша и городская жизнь Красноуфимска и района.",
};

export default async function HomePage() {
  const news = await getAllNews();
  const events = await getAllEvents();
  const latest = news.slice(0, 5);
    const nearestEvents = events.slice(0, 5);

  return (
      <div className={styles.page}>
        <section>
          <h1 className={styles.heroTitle}>Поток 96</h1>
          <p className={styles.heroText}>
            Городские новости, афиша, люди и проекты Красноуфимска и района. Это учебный
            портал: сначала контент и скорость, затем — расширение функций.
          </p>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Последние новости</h2>

          <div className={styles.list}>
            {latest.map((n) => (
                <article key={n.slug} className={styles.card}>
                  <div className={styles.meta}>{n.date}</div>

                  <Link href={`/news/${n.slug}`} className={styles.link}>
                    {n.title}
                  </Link>

                  <div className={styles.summary}>{n.summary}</div>
                </article>
            ))}
          </div>

          <div className={styles.more}>
            <Link href="/news">Все новости →</Link>
          </div>
        </section>
          <section>
              <h2 className={styles.sectionTitle}>Ближайшие события</h2>

              <div className={styles.list}>
                  {nearestEvents.map((e) => (
                      <article key={e.slug} className={styles.card}>
                          <div className={styles.meta}>
                              {e.startAt} {e.location ? `• ${e.location}` : ""} {e.price ? `• ${e.price}` : ""}
                          </div>

                          <Link href={`/events/${e.slug}`} className={styles.link}>
                              {e.title}
                          </Link>

                          {e.summary && <div className={styles.summary}>{e.summary}</div>}
                      </article>
                  ))}
              </div>
              <div className={styles.more}>
                  <Link href="/events">Вся афиша →</Link>
              </div>
          </section>
      </div>
  );
}
