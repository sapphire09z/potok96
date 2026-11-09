-- Profile fields: e-mail is NOT verified until a separate verification flow is implemented.
ALTER TABLE "User"
    ADD COLUMN "displayName" VARCHAR(80),
    ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
