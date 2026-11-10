
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";

export const SESSION_COOKIE =
    process.env.NODE_ENV === "production"
        ? "__Host-potok96_session"
        : "potok96_session";

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token) {
    return createHash("sha256")
        .update(token)
        .digest("hex");
}

export async function createUserSession(phone) {
    if (!/^\+7\d{10}$/.test(phone)) {
        throw new Error("Invalid verified phone");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
        Date.now() + SESSION_SECONDS * 1000
    );

    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
            where: { phone },
            create: { phone },
            update: {},
            select: { id: true, role: true, archivedAt: true },
        });

        if (user.archivedAt) {
            throw new Error("Archived account cannot sign in");
        }

        // Staff privileges are activated only after the provider has verified
        // ownership of this exact phone. QA grants never reach this function.
        if (user.role === "USER") {
            const now = new Date();
            const invitation = await tx.staffInvitation.findFirst({
                where: {
                    phone,
                    consumedAt: null,
                    revokedAt: null,
                    expiresAt: { gt: now },
                },
                orderBy: { createdAt: "desc" },
                select: { id: true, createdById: true },
            });
            if (invitation) {
                const claimed = await tx.staffInvitation.updateMany({
                    where: {
                        id: invitation.id,
                        consumedAt: null,
                        revokedAt: null,
                        expiresAt: { gt: now },
                    },
                    data: { consumedAt: now, acceptedById: user.id },
                });
                if (claimed.count !== 1) {
                    throw new Error("Staff invitation was concurrently claimed");
                }
                const promoted = await tx.user.updateMany({
                    where: { id: user.id, role: "USER" },
                    data: { role: "MODERATOR" },
                });
                if (promoted.count !== 1) {
                    throw new Error("Staff role changed during invitation acceptance");
                }
                // Remove all pre-existing access tokens when the account gains privileges.
                const revoked = await tx.userSession.deleteMany({ where: { userId: user.id } });
                if (revoked.count > 0) {
                    await tx.adminSessionRevocation.create({
                        data: {
                            actorId: invitation.createdById,
                            targetId: user.id,
                            revokedCount: revoked.count,
                        },
                    });
                }
                await tx.adminRoleChange.create({
                    data: {
                        actorId: invitation.createdById,
                        targetId: user.id,
                        oldRole: "USER",
                        newRole: "MODERATOR",
                    },
                });
            }
        }

        await tx.userSession.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            },
        });
    }, { isolationLevel: "Serializable", timeout: 10000 });

    return { token, expiresAt };
}

export function setSessionCookie(response, session) {
    response.cookies.set({
        name: SESSION_COOKIE,
        value: session.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_SECONDS,
        expires: session.expiresAt,
        priority: "high",
    });
}

export function clearSessionCookie(response) {
    response.cookies.set({
        name: SESSION_COOKIE,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
}

export async function getCurrentUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (!token || !TOKEN_PATTERN.test(token)) {
        return null;
    }

    const session = await getPrisma().userSession.findUnique({
        where: {
            tokenHash: hashToken(token),
        },
        select: {
            expiresAt: true,
            user: {
                select: {
                    id: true,
                    phone: true,
                    role: true,
                    archivedAt: true,
                },
            },
        },
    });

    if (!session || session.expiresAt <= new Date() || session.user.archivedAt) {
        return null;
    }

    return session.user;
}

export async function revokeUserSession(token) {
    if (!token || !TOKEN_PATTERN.test(token)) {
        return;
    }

    await getPrisma().userSession.deleteMany({
        where: {
            tokenHash: hashToken(token),
        },
    });
}
