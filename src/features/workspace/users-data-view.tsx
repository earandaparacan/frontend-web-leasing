import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import type { Pagination } from "@/lib/staff-data";
import styles from "./users-data-view.module.css";

type UserRow = { id: string; username: string; email: string; type: ReactNode; groups: string; status: ReactNode; lastAccess: string };

type Props = { rows: UserRow[]; pagination: Pagination; search: string; type: string; error?: string };

function href(page: number, search: string, type: string) {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (type) query.set("type", type);
  query.set("page", String(page));
  return `/panel/usuarios?${query}`;
}

export function UsersDataView({ rows, pagination, search, type, error }: Props) {
  const first = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.page_size + 1;
  const last = Math.min(pagination.page * pagination.page_size, pagination.total);
  return <div className={`${styles.page} workspace-page`}>
    <nav className={styles.breadcrumb} aria-label="Migas de pan"><Link href="/panel">Dashboard</Link><ChevronRightIcon /><span>Usuarios</span></nav>
    <header className={styles.header}><span>ADMINISTRACIÓN</span><h1>Usuarios</h1><p>Consultá cuentas, perfiles de acceso y el estado de los usuarios del ecosistema Teklease.</p></header>
    <section className={styles.card} aria-labelledby="users-heading">
      <div className={styles.cardHeader}><h2 id="users-heading">Usuarios</h2><span>{pagination.total} usuarios</span></div>
      <form className={styles.filters} method="get">
        <label className={styles.search}><span className="sr-only">Buscar usuarios</span><SearchIcon /><input name="search" defaultValue={search} placeholder="Buscar por nombre, email o documento" /></label>
        <select name="type" defaultValue={type} aria-label="Tipo de usuario"><option value="">Todos los tipos</option><option value="customer">Cliente</option><option value="staff">Usuario interno</option></select>
        <select aria-label="Grupo de usuario" defaultValue=""><option value="">Todos los grupos</option></select>
        <select aria-label="Estado de usuario" defaultValue=""><option value="">Todos los estados</option></select>
        {search || type ? <Link className={styles.clear} href="/panel/usuarios">Limpiar</Link> : <span className={styles.clear}>Limpiar</span>}
        <button type="submit">Aplicar filtros</button>
      </form>
      {error ? <div className={styles.error}><strong>No se pudieron cargar los usuarios</strong><span>{error}</span></div> : null}
      <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkbox}><input type="checkbox" aria-label="Seleccionar todos los usuarios" /></th><th>Usuario</th><th>Tipo</th><th>Grupos</th><th>Estado</th><th>Último acceso</th><th className={styles.actions}>Acciones</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className={styles.checkbox}><input type="checkbox" aria-label={`Seleccionar a ${row.username}`} /></td><td><div className={styles.user}><Avatar username={row.username} /><span><strong>{row.username}</strong><small>{row.email || "Sin email"}</small></span></div></td><td>{row.type}</td><td>{row.groups}</td><td>{row.status}</td><td>{row.lastAccess}</td><td className={styles.actions}><button className={styles.actionButton} type="button" aria-label={`Acciones para ${row.username}`}><i /><i /><i /></button></td></tr>)}</tbody></table></div>
      {!error && rows.length === 0 ? <div className={styles.empty}>No se encontraron usuarios con los filtros actuales.</div> : null}
      <footer className={styles.pagination}><span>Mostrando {first}–{last} de {pagination.total}</span><div>{pagination.page > 1 ? <Link aria-label="Página anterior" href={href(pagination.page - 1, search, type)}><ChevronRightIcon /></Link> : <span><ChevronRightIcon /></span>}<strong>{pagination.page}</strong>{pagination.page < pagination.total_pages ? <Link className={styles.next} aria-label="Página siguiente" href={href(pagination.page + 1, search, type)}><ChevronRightIcon /></Link> : <span className={styles.next}><ChevronRightIcon /></span>}</div></footer>
    </section>
  </div>;
}

function Avatar({ username }: { username: string }) { const initials = username.split(/[.@\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U"; return <span className={styles.avatar} aria-hidden="true">{initials}</span>; }
export function UserStatusPill({ label, tone }: { label: string; tone: "good" | "neutral" | "info" }) { return <span className={`${styles.status} ${styles[`status--${tone}`]}`}>{tone === "good" ? <CheckIcon /> : <i />}{label}</span>; }
function SearchIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>; }
