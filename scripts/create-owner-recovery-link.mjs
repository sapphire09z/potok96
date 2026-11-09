import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

// Emergency owner access is deliberately staging-only. Never make this script
// accept a requested user ID, an arbitrary phone or an arbitrary role.
const ORIGIN = "https://staging.potok96.ru";
const ownerPhone = process.env.STAGING_OWNER_PHONE;

if (
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_ALLOWED_ORIGIN !== ORIGIN ||
    process.env.STAGING_OWNER_RECOVERY_ENABLED !== "true" ||
    !/^\+7\d{10}$/.test(ownerPhone || "")
) {
    console.error("Staging owner recovery is not explicitly enabled or configured.");
    process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
    await db.connect();
    const { rows } = await db.query(
        `SELECT "id" FROM "User"
         WHERE "phone" = $1 AND "role" = 'ADMIN'
         LIMIT 2`,
        [ownerPhone]
    );
    if (rows.length !== 1) {
        throw new Error("Configured owner phone must match exactly one ADMIN account.");
    }

    const token = randomBytes(32).toString("base64url");
    // An owner recovery grant cannot be used directly as an authenticated
    // UserSession: its hash deliberately differs from the session token hash.
    const tokenHash = createHash("sha256")
        .update(`owner-recovery-v1:${token}`)
        .digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
        `INSERT INTO "UserSession" ("id", "userId", "tokenHash", "expiresAt")
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), rows[0].id, tokenHash, expiresAt]
    );

    console.log("\nOne-time staging owner recovery link (5 minutes, single use):");
    console.log(`${ORIGIN}/owner-recovery#token=${token}`);
    console.log("Do not copy the link into chat, commits, logs or tickets.");
} catch (error) {
    console.error("Owner recovery grant creation failed:", error.message);
    process.exitCode = 1;
} finally {
    await db.end().catch(() => {});
}
