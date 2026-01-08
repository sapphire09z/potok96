export default function NewsItemPage({ params }) {
    // params.slug — это то, что стоит в URL после /news/
    const { slug } = params;

    return (
        <article style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Черновик страницы материала</div>

            <h1 style={{ margin: 0, fontSize: 26 }}>Новость: {slug}</h1>

            <p style={{ margin: 0, opacity: 0.85 }}>
                Сейчас это заглушка. На следующем этапе мы подключим Markdown и будем
                подставлять сюда реальный заголовок, дату и текст.
            </p>
        </article>
    );
}
