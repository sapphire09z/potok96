-- Stage 5.6.3: grant optional extended organization placement until a fixed
-- end-of-day deadline; no billing, ranking, or public-layout changes yet.
CREATE TYPE "OrgPlacement" AS ENUM ('BASIC', 'EXTENDED');

ALTER TABLE "Organization"
    ADD COLUMN "placement" "OrgPlacement" NOT NULL DEFAULT 'BASIC',
    ADD COLUMN "extendedUntil" TIMESTAMP(3);

CREATE INDEX "Organization_placement_extendedUntil_idx"
    ON "Organization"("placement", "extendedUntil");
