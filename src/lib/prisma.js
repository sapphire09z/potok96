
import { PrismaClient } from "../../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

export function getPrisma() {
    if (globalThis.__potok96Prisma) {
        return globalThis.__potok96Prisma;
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error("DATABASE_URL is not configured");
    }

    const adapter = new PrismaPg({
        connectionString,
        max: 5,
        connectionTimeoutMillis: 5000,
    });

    const prisma = new PrismaClient({ adapter });

    globalThis.__potok96Prisma = prisma;

    return prisma;
}
