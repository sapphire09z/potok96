import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const origin = "https://staging.potok96.ru";
const requestedRole = process.argv[2]?.toUpperCase();
const phone = process.argv[3];

if (
    process.env.STAGING_QA_LOGIN_ENABLED !== "true" ||
    process.env.AUTH_ALLOWED_ORIGIN !== origin ||
    process.env.NODE_ENV !== "production"
) {
    console.error("QA login is not enabled for staging.");
    process.exit(1);
}

if (
    !["USER", "MODERATOR"].includes(requestedRole) ||
    (phone && !/^\+7\d{10}$/.test(phone))
) {
    console.error("Usage: node scripts/create-qa-link.mjs USER|MODERATOR [+7xxxxxxxxxx]");
    process.exit(2);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
    await db.connect();

    const params = phone ? [requestedRole, phone] : [requestedRole];
    const where = phone
        ? '"role"::text = $1 AND "phone" = $2'
        : '"role"::text = $1';
    const { rows } = await db.query(
        `SELECT "id" FROM "User" WHERE ${where} ORDER BY "createdAt" LIMIT 2`,
        params
    );

    if (rows.length === 0) {
        throw new Error(`No ${requestedRole} account found.`);
    }
    if (rows.length > 1) {
        throw new Error(`Multiple ${requestedRole} accounts found. Specify the test phone.`);
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256")
        .update(`qa-login:${token}`)
        .digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
        `INSERT INTO "UserSession" ("id", "userId", "tokenHash", "expiresAt")
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), rows[0].id, tokenHash, expiresAt]
    );

    console.log(`\n${requestedRole} — одноразовая ссылка на 5 минут:`);
    console.log(`${origin}/qa-login#token=${token}\n`);
    console.log("Не публикуйте ссылку: она даёт доступ к тестовому аккаунту.");
} catch (error) {
    console.error("Failed to issue QA login link:", error.message);
    process.exitCode = 1;
} finally {
    await db.end().catch(() => {});
}
