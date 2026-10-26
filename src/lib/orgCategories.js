
export const ORG_CATEGORIES = [
    { id: "culture", title: "Культура и досуг" },
    { id: "sports", title: "Спорт" },
    { id: "education", title: "Образование" },
    { id: "shops", title: "Магазины" },
    { id: "food", title: "Кафе и рестораны" },
    { id: "services", title: "Услуги" },
    { id: "health", title: "Здоровье" },
    { id: "beauty", title: "Красота" },
    { id: "auto", title: "Автомобили" },
    { id: "government", title: "Учреждения" },
    { id: "media", title: "СМИ и информация" },
    { id: "other", title: "Другое" },
];

export function getOrgCategoryTitle(id) {
    return (
        ORG_CATEGORIES.find((item) => item.id === id)?.title ??
        "Другое"
    );
}
