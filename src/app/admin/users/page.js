import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import RoleEditor from "./RoleEditor";
import SessionControls from "./SessionControls";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

const PER_PAGE = 25;
const ROLES = ["USER", "MODERATOR", "ADMIN"];
const labels = { USER: "Пользователь", MODERATOR: "Модератор", ADMIN: "Администратор" };

function pageUrl({ search, role, page }) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (role) params.set("role", role);
    if (page > 1) params.set("page", String(page));
    const suffix = params.toString();
    return `/admin/users${suffix ? `?${suffix}` : ""}`;
}

export default async function AdminUsersPage({ searchParams }) {
    // Repeat authorization here: layouts and page data can render concurrently.
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const params = await searchParams;
    const search = typeof params?.q === "string" ? params.q.trim().slice(0, 80) : "";
    const role = ROLES.includes(params?.role) ? params.role : "";
    const requestedPage = Number(params?.page ?? 1);
    const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10000
        ? requestedPage : 1;
    const where = role ? { role } : {};
    if (search) {
        where.OR = [
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
        ];
        if (/^[A-Za-z0-9][A-Za-z0-9_-]{2,99}$/.test(search)) where.OR.push({ id: search });
    }
    const prisma = getPrisma();
    const [total, users, history] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({ where,
            select: { id: true, phone: true, email: true, role: true, createdAt: true, updatedAt: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: PER_PAGE, skip: (page - 1) * PER_PAGE,
        }),
        prisma.adminRoleChange.findMany({ orderBy: { createdAt: "desc" }, take: 15,
            select: { id: true, actorId: true, targetId: true, oldRole: true, newRole: true, createdAt: true } }),
    ]);
    const ids = users.map((item) => item.id);
    const [sessionRows, adRows, newsRows, actionRows, revocations] = await Promise.all([
        ids.length ? prisma.userSession.groupBy({
            by: ["userId"], where: { userId: { in: ids }, expiresAt: { gt: new Date() } },
            _count: { _all: true },
        }) : [],
        ids.length ? prisma.classifiedAd.groupBy({
            by: ["ownerId"], where: { ownerId: { in: ids } }, _count: { _all: true },
        }) : [],
        ids.length ? prisma.newsPost.groupBy({
            by: ["createdById"], where: { createdById: { in: ids } }, _count: { _all: true },
        }) : [],
        ids.length ? prisma.newsWorkflowEvent.groupBy({
            by: ["actorId"], where: { actorId: { in: ids } }, _count: { _all: true },
        }) : [],
        prisma.adminSessionRevocation.findMany({
            orderBy: { createdAt: "desc" }, take: 10,
            select: { id: true, actorId: true, targetId: true, revokedCount: true, createdAt: true },
        }),
    ]);
    const counts = (rows, key) => new Map(rows.map((item) => [item[key], item._count._all]));
    const sessions = counts(sessionRows, "userId");
    const ads = counts(adRows, "ownerId");
    const news = counts(newsRows, "createdById");
    const editorial = counts(actionRows, "actorId");
    const formatter = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short" });
    const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

    return <main className={styles.content}>
        <div className={styles.sectionHeading}>
            <h2>Пользователи и роли</h2>
            <p>Найдено: {total}. Роли и неистёкшие записи доступа (сессии и одноразовые ссылки). Удаление учётной записи с историей и материалами пока недоступно.</p>
        </div>
        <form action="/admin/users" method="get" className={styles.filters}>
            <label>Поиск по телефону, e-mail или ID
                <input type="search" name="q" maxLength={80} defaultValue={search} placeholder="Телефон, почта, ID" />
            </label>
            <label>Роль
                <select name="role" defaultValue={role}>
                    <option value="">Все роли</option>
                    {ROLES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
                </select>
            </label>
            <button type="submit">Найти</button>
            <Link href="/admin/users">Сбросить</Link>
        </form>
        {users.length === 0 ? <section className={styles.panel}><p>Пользователи не найдены.</p></section> :
            <div className={styles.userList}>{users.map((user) =>
                <article key={user.id} className={styles.userCard}>
                    <div className={styles.userInfo}>
                        <strong>{user.phone || user.email || "Учётная запись без контактов"}</strong>
                        {user.phone && user.email && <span>{user.email}</span>}
                        <code title={user.id}>ID: {user.id}</code>
                        <span>Создан: {formatter.format(user.createdAt)}</span>
                        <span className={styles.userAssets}>Связано: объявлений {ads.get(user.id) ?? 0} · новостей {news.get(user.id) ?? 0} · редакционных действий {editorial.get(user.id) ?? 0}</span>
                        {user.id === me.id && <span className={styles.selfMark}>Текущий администратор (вы)</span>}
                    </div>
                    <div>
                        <RoleEditor key={`${user.id}:${user.role}:${user.updatedAt.toISOString()}`}
                            userId={user.id} role={user.role} updatedAt={user.updatedAt.toISOString()}
                            isSelf={user.id === me.id} />
                        <SessionControls userId={user.id} role={user.role}
                            updatedAt={user.updatedAt.toISOString()} activeCount={sessions.get(user.id) ?? 0}
                            isSelf={user.id === me.id} />
                    </div>
                </article>
            )}</div>}
        <div className={styles.pager}>
            {page > 1 ? <Link href={pageUrl({ search, role, page: page - 1 })}>← Назад</Link> : <span />}
            <span>Страница {page} из {lastPage}</span>
            {page < lastPage ? <Link href={pageUrl({ search, role, page: page + 1 })}>Далее →</Link> : <span />}
        </div>
        <section className={styles.panel}>
            <h2>Журнал изменений ролей</h2>
            <p className={styles.muted}>Фиксируются действия через эту панель. Ранее выполненные SQL-изменения в журнал не попадают.</p>
            {history.length === 0 ? <p className={styles.muted}>История пока пуста.</p> :
                <ol className={styles.history}>{history.map((item) => <li key={item.id}>
                    <time>{formatter.format(item.createdAt)}</time>
                    <span>{item.oldRole} → <strong>{item.newRole}</strong></span>
                    <code title={`Цель: ${item.targetId}; Администратор: ${item.actorId}`}>ID: {item.targetId.slice(0, 12)}…</code>
                </li>)}</ol>}
        </section>
        <section className={styles.panel}>
            <h2>Журнал завершения сессий</h2>
            <p className={styles.muted}>Учёт всех отзывов доступа через эту панель. Количество включает сессии и неиспользованные одноразовые ссылки.</p>
            {revocations.length === 0 ? <p className={styles.muted}>Отзывов пока нет.</p> :
                <ol className={styles.history}>{revocations.map((item) => <li key={item.id}>
                    <time>{formatter.format(item.createdAt)}</time>
                    <span>Отозвано: <strong>{item.revokedCount}</strong></span>
                    <code title={`Цель: ${item.targetId}; Администратор: ${item.actorId}`}>ID: {item.targetId.slice(0, 20)}…</code>
                </li>)}</ol>}
        </section>
    </main>;
}
