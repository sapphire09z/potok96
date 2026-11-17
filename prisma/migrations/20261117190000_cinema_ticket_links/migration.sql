-- Stage 5.14.5: ONLY explicit admin-confirmed Pushkin status and external purchase URLs.
-- Imported provider values remain unchanged. A changed screening identity invalidates confirmation.
ALTER TABLE "CinemaSession"
    ADD COLUMN "verifiedPushkinId" VARCHAR(120),
    ADD COLUMN "pushkinVerifiedFingerprint" VARCHAR(64),
    ADD COLUMN "pushkinProofNote" VARCHAR(500),
    ADD COLUMN "ticketUrl" VARCHAR(2048),
    ADD COLUMN "ticketVerifiedFingerprint" VARCHAR(64),
    ADD COLUMN "listingReviewedById" VARCHAR(100),
    ADD COLUMN "listingReviewedAt" TIMESTAMPTZ(3);
