-- One verified official booking-page address per movie, not per session.
-- Legacy per-session confirmation data is retained but no longer used publicly.
ALTER TABLE "CinemaMovie" ADD COLUMN "ticketPageUrl" VARCHAR(2048);
