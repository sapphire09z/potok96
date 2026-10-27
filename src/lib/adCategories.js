
export const AD_CATEGORIES = [
    { id: "sale", title: "Продажа вещей" },
    { id: "buy", title: "Куплю" },
    { id: "property", title: "Недвижимость" },
    { id: "transport", title: "Транспорт" },
    { id: "jobs", title: "Работа" },
    { id: "services", title: "Услуги" },
    { id: "free", title: "Отдам бесплатно" },
    { id: "lost", title: "Потери и находки" },
    { id: "other", title: "Другое" },
];

export function getAdCategoryTitle(id) {
    return (
        AD_CATEGORIES.find((item) => item.id === id)?.title ??
        "Другое"
    );
}
