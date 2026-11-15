// Stage 5.11: direct ADMIN editing of published organization cards.
// Published slugs are immutable to preserve backlinks and owner claims.
export function isEditableOrgStatus(status) {
    return status === "DRAFT" || status === "PUBLISHED";
}

export function canUpdateOrgSlug(status, currentSlug, nextSlug) {
    return isEditableOrgStatus(status) && (status === "DRAFT" || currentSlug === nextSlug);
}

// A published gallery never contains newly uploaded images without usage rights.
export function validPublishedOrgImageRights(credit, rightsNote) {
    return typeof credit === "string" && typeof rightsNote === "string" &&
        credit.trim().length > 0 && credit.trim().length <= 240 &&
        rightsNote.trim().length > 0 && rightsNote.trim().length <= 1000;
}
