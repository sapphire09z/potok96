-- Stage 5.6.4: optional premium-only content, retained when placement expires.
ALTER TABLE "Organization"
    ADD COLUMN "priceItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "specialOffers" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "extraLinks" JSONB NOT NULL DEFAULT '[]'::jsonb;
