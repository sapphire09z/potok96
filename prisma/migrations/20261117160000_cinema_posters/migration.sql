-- Stage 5.14.3: verified, immutable Selectel poster object references.
-- Existing movies/sessions and their prices are preserved.
ALTER TABLE "CinemaMovie"
  ADD COLUMN "posterMediaId" INTEGER,
  ADD COLUMN "posterKey" VARCHAR(512),
  ADD COLUMN "posterHash" VARCHAR(64);
