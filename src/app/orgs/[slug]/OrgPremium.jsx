import styles from "./org.module.css";

export default function OrgPremium({ priceItems = [], specialOffers = [], extraLinks = [] }) {
    if (!priceItems.length && !specialOffers.length && !extraLinks.length) return null;

    return <div className={styles.premiumContent}>
        {priceItems.length > 0 && <section className={styles.section} aria-label="Услуги и цены">
            <div className={styles.sectionHeader}><h2>Услуги и цены</h2><span>{priceItems.length}</span></div>
            <div className={styles.priceList}>{priceItems.map((item, index) =>
                <div key={index} className={styles.priceRow}>
                    <div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div>
                    <strong>{item.price}</strong>
                </div>)}</div>
        </section>}
        {specialOffers.length > 0 && <section className={styles.section} aria-label="Специальные предложения">
            <div className={styles.sectionHeader}><h2>Специальные предложения</h2></div>
            <div className={styles.offersGrid}>{specialOffers.map((offer, index) =>
                <article className={styles.offer} key={index}>
                    <h3>{offer.title}</h3><p>{offer.description}</p>
                </article>)}</div>
        </section>}
        {extraLinks.length > 0 && <nav className={styles.premiumLinks} aria-label="Дополнительные действия">
            {extraLinks.map((link, index) => <a key={index} href={link.url}
                target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}
        </nav>}
    </div>;
}
