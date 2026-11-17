-- Stage 5.14.1: CinemaWebApi read-only imported catalogue.
-- No modifications to existing news/events/movie content.
CREATE TABLE "CinemaMovie" (
    "externalId" INTEGER NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "story" TEXT NOT NULL DEFAULT '',
    "durationMinutes" INTEGER,
    "ageRating" VARCHAR(16) NOT NULL DEFAULT '',
    "genres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "directors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cast" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "media" JSONB NOT NULL DEFAULT '[]',
    "pzApiId" VARCHAR(120),
    "kinoplanId" INTEGER,
    "pushkinId" VARCHAR(120),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "CinemaMovie_pkey" PRIMARY KEY ("externalId")
);

CREATE TABLE "CinemaSession" (
    "externalId" INTEGER NOT NULL,
    "movieExternalId" INTEGER NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "hallExternalId" INTEGER,
    "hallName" VARCHAR(120) NOT NULL DEFAULT '',
    "formatName" VARCHAR(60) NOT NULL DEFAULT '',
    "formatExternalId" INTEGER,
    "prices" JSONB NOT NULL DEFAULT '[]',
    "minPriceRub" DECIMAL(10,2),
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "isEvent" BOOLEAN NOT NULL DEFAULT false,
    "noSeats" BOOLEAN NOT NULL DEFAULT false,
    "rentalLicense" INTEGER,
    "pushkinId" VARCHAR(120),
    "textCode" VARCHAR(40) NOT NULL DEFAULT '',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "CinemaSession_pkey" PRIMARY KEY ("externalId")
);
CREATE INDEX "CinemaMovie_isCurrent_title_idx" ON "CinemaMovie"("isCurrent", "title");
CREATE INDEX "CinemaSession_isCurrent_startAt_idx" ON "CinemaSession"("isCurrent", "startAt");
CREATE INDEX "CinemaSession_movieExternalId_startAt_idx" ON "CinemaSession"("movieExternalId", "startAt");
ALTER TABLE "CinemaSession" ADD CONSTRAINT "CinemaSession_movieExternalId_fkey"
    FOREIGN KEY ("movieExternalId") REFERENCES "CinemaMovie"("externalId") ON DELETE RESTRICT ON UPDATE CASCADE;
