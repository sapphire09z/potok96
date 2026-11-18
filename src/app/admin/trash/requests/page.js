import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { mediaPrefix } from "@/lib/contentCleanupPreview.mjs";
import PurgeQueuePanel from "./PurgeQueuePanel";
import styles from "../trash.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявки на очистку — Поток 96", robots: { index: false, follow: false } };

export default async function PurgeRequestsPage({ searchParams }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") notFound();
  const db = getPrisma();
  const account = await db.user.findUnique({ where: { id: me.id }, select: { role: true, archivedAt: true } });
  if (account?.role !== "ADMIN" || account.archivedAt) notFound();
  const params = await searchParams;
  const kind = typeof params?.kind === "string" ? params.kind : "";
  const id = typeof params?.id === "string" ? params.id : "";
  if (kind || id) {
    try { mediaPrefix(kind, id); } catch { notFound(); }
  }
  const [rows, item] = await Promise.all([
    db.contentPurgeRequest.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 40,
      include: { events: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10 },
        plans: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 } },
    }),
    kind && id ? db[kind === "news" ? "newsPost" : "eventPost"].findUnique({
      where: { id }, select: { id: true, title: true, status: true, updatedAt: true, trashedAt: true },
    }) : Promise.resolve(null),
  ]);
  const selected = item && item.status === "TRASHED" && item.trashedAt ? {
    kind, id: item.id, title: item.title,
    updatedAt: item.updatedAt.toISOString(), trashedAt: item.trashedAt.toISOString(),
  } : null;
  const requests = rows.map(row => ({
    id: row.id, kind: row.kind, itemId: row.itemId, title: row.title,
    reason: row.reason, status: row.status,
    trashedAt: row.trashedAt.toISOString(), requestedById: row.requestedById,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastCheck: row.lastCheck,
    plan: row.plans[0] ? { id: row.plans[0].id, digest: row.plans[0].digest,
      status: row.plans[0].status, createdAt: row.plans[0].createdAt.toISOString(),
      report: row.plans[0].report } : null,
    events: row.events.map(event => ({
      id: event.id, action: event.action, note: event.note,
      actorId: event.actorId, createdAt: event.createdAt.toISOString(),
    })),
  }));
  return <main className={styles.page}>
    <Link className={styles.back} href="/admin/trash">← В корзину</Link>
    <header className={styles.heading}>
      <h1>Очередь заявок на очистку</h1>
      <p>Этап 5.15.2.2: запись заявки, отмена и ручная повторная проверка.
        Заявка не запускает удаление ни из PostgreSQL, ни из Selectel S3.
        Фонового исполнителя нет.</p>
    </header>
    <PurgeQueuePanel selected={selected} requests={requests} />
  </main>;
}
