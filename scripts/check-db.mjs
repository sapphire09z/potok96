
import { getPrisma } from "../src/lib/prisma.js";

const prisma = getPrisma();

try {
    const [users, ads, photos] = await Promise.all([
        prisma.user.count(),
        prisma.classifiedAd.count(),
        prisma.adPhoto.count(),
    ]);

    console.log("Database connection: OK");
    console.log({ users, ads, photos });
} catch (error) {
    console.error("Database check failed:", error.message);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
