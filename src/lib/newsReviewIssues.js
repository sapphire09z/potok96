// Единственная проверка обязательных сведений перед отправкой на проверку
// и перед окончательным одобрением. Она не препятствует сохранению черновиков.
export function newsReviewIssues(post) {
    const issues = [];
    if (!post.title?.trim()) issues.push("Заполните заголовок новости.");
    if (!post.slug?.trim()) issues.push("Укажите адрес новости.");
    if (!post.body?.trim()) issues.push("Добавьте текст новости.");

    if (post.sourceKind !== "OWN") {
        if (!post.sourceName?.trim()) issues.push("Укажите название источника материала.");
        if (!post.sourceUrl?.trim()) issues.push("Добавьте прямую HTTPS-ссылку на источник.");
    }
    if (["THIRD_PARTY", "OTHER"].includes(post.sourceKind) && !post.rightsNote?.trim()) {
        issues.push("Укажите основание использования стороннего материала.");
    }
    for (const [index, image] of (post.images ?? []).entries()) {
        // Номер совпадает с порядком фотографий в редакционной галерее.
        const label = `Фото №${index + 1}`;
        if (!image.credit?.trim()) issues.push(`${label}: заполните автора / правообладателя.`);
        if (!image.rightsNote?.trim()) issues.push(`${label}: заполните основание использования / лицензию.`);
    }
    if (post.coverImageId && !(post.images ?? []).some((image) => image.id === post.coverImageId)) {
        issues.push("Выбранной обложки нет в фотогалерее.");
    }
    return issues;
}
