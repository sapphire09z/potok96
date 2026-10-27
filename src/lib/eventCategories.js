export const EVENT_CATEGORIES = [
    { id: "cinema", title: "Кино" },
    { id: "concert", title: "Концерты" },
    { id: "theater", title: "Театр" },
    { id: "sport", title: "Спорт" },
    { id: "exhibition", title: "Выставки" },
    { id: "workshop", title: "Мастер-классы" },
    { id: "other", title: "Другие события" },
];

export function getEventCategoryTitle(id) {
    return EVENT_CATEGORIES.find(
        (item) => item.id === id
    )?.title ?? "Другие события";
}