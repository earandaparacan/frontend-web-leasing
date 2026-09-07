import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "@/components/icons";
import { getCollectionConflicts } from "@/lib/collection-conflicts";
import { firstQueryValue, formatStaffDate } from "@/lib/staff-data";
import { StatusPill } from "@/features/workspace/staff-data-view";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "IMEI duplicados | Teklease",
  description: "Conflictos de asignación de equipos en cobranzas.",
};

export default async function ImeiConflictsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstQueryValue(params.search);
  const kind = firstQueryValue(params.kind);
  const history = firstQueryValue(params.history) === "1" ? "1" : "";
  const data = await getCollectionConflicts({ search, kind, history, page: firstQueryValue(params.page) });
  const scan = data.latest_scan;
  function pageHref(page: number) {
    return `/panel/imei-duplicados?${new URLSearchParams({ search, kind, history, page: String(page) })}`;
  }
  const exportQuery = new URLSearchParams();
  if (search) exportQuery.set("search", search);
  if (kind) exportQuery.set("kind", kind);
  if (history) exportQuery.set("history", history);
  const exportHref = `/api/collections/imei-conflicts/export${exportQuery.size ? `?${exportQuery}` : ""}`;

  return (
    <div className={`${styles.page} workspace-page`}>
      <nav aria-label="Migas de pan"><Link href="/panel">Dashboard</Link><span> / IMEI duplicados</span></nav>
      <header className={styles.header}>
        <span className={styles.eyebrow}>CONTROL DE COBRANZAS</span>
        <h1>IMEI duplicados</h1>
        <p>Equipos asociados a varias órdenes. Los conflictos detectados se excluyen de nuevos bloqueos y mensajes de la política de cobranzas para su análisis.</p>
      </header>
      {scan ? (
        <section className={styles.summary} aria-label="Última revisión">
          <div><strong>{scan.device_count}</strong><span>Equipos con conflicto</span></div>
          <div><strong>{scan.order_count}</strong><span>Órdenes involucradas</span></div>
          <div><b>Última revisión · {formatStaffDate(scan.detected_at)}</b>
            <span>Ejecución #{scan.execution_id}{scan.dry_run ? " · Simulación" : ""}</span>
            <span>Plan {scan.scope.plan_id ?? "configurado"} · {scan.scope.subscription_state === "3_progress" ? "Suscripciones en curso" : "Estado de suscripción configurado"} · Todas las etapas, incluyendo sin mora</span>
          </div>
        </section>
      ) : null}
      <section className={styles.content} aria-labelledby="conflicts-heading">
        <h2 id="conflicts-heading">{history ? "Historial de detecciones" : "Conflictos de la última revisión"}</h2>
        <p className={styles.note}>Los datos se actualizan con cada consulta de la política a Odoo. El historial conserva la evidencia; una detección anterior no confirma que el conflicto siga vigente.</p>
        <form method="get" className={styles.filters}>
          <label className={styles.search}>Buscar<input name="search" defaultValue={search} placeholder="IMEI, cliente, orden, sucursal o responsable" /></label>
          <label>Tipo<select name="kind" defaultValue={kind}><option value="">Todos</option><option value="cross_customer">Clientes diferentes</option><option value="same_customer">Mismo cliente</option></select></label>
          <label>Vista<select name="history" defaultValue={history}><option value="">Última revisión</option><option value="1">Historial</option></select></label>
          <button type="submit">Aplicar filtros</button>
          <a className={styles.exportButton} href={exportHref} download><DownloadIcon />Exportar a Excel</a>
          <Link href="/panel/imei-duplicados">Limpiar</Link>
        </form>
        {data.error ? <div role="alert" className={styles.empty}><strong>No se pudieron cargar los casos</strong><p>{data.error}</p><Link href={pageHref(data.pagination.page)}>Reintentar</Link></div> : (
          <>
            <p className={styles.note}>{data.pagination.total} {history ? (data.pagination.total === 1 ? "detección" : "detecciones") : (data.pagination.total === 1 ? "equipo" : "equipos")} con los filtros actuales</p>
            {!data.results.length ? <div className={styles.empty}><strong>{scan ? "No hay conflictos para esta consulta" : "Todavía no hay revisiones globales"}</strong><p>{scan ? "Podés ajustar los filtros o consultar el historial." : "Los casos aparecerán después de la próxima consulta de la política de cobranzas a Odoo."}</p></div> : null}
            <div className={styles.cards}>
              {data.results.map((conflict) => (
                <article key={conflict.id} className={styles.card}>
                  <header><div><span className={styles.eyebrow}>IMEI</span><h3>{conflict.imei}</h3></div><StatusPill label={conflict.kind === "cross_customer" ? "Clientes diferentes" : "Mismo cliente"} tone={conflict.kind === "cross_customer" ? "bad" : "warning"} /></header>
                  <p className={styles.note}>{conflict.order_count} órdenes · {conflict.customer_count} {conflict.customer_count === 1 ? "cliente" : "clientes"} · Detectado {formatStaffDate(conflict.detected_at)} · Ejecución #{conflict.execution_id}{conflict.dry_run ? " · Simulación" : ""}</p>
                  <ul className={styles.orders}>
                    {conflict.orders.map((order) => (
                      <li key={order.order_id}>
                        <div><strong>{order.order_name || `Orden ${order.order_id}`}</strong><span>ID {order.order_id}</span></div>
                        <div><strong>{order.partner_name || "Cliente sin nombre"}</strong><span>Cliente Odoo {order.partner_id ?? "sin identificar"}</span></div>
                        <div><strong>{order.phase === 0 ? "Sin mora" : `Fase ${order.phase}`}</strong><span>{order.overdue_count} facturas vencidas</span></div>
                        <div><strong>{order.sucursal || "Sin sucursal"}</strong><span>{order.operador || "Sin responsable"}</span></div>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            {data.pagination.total_pages > 1 ? <nav className={styles.pagination} aria-label="Paginación"><span>Página {data.pagination.page} de {data.pagination.total_pages}</span><div>{data.pagination.page > 1 ? <Link href={pageHref(data.pagination.page - 1)}>Anterior</Link> : null}{data.pagination.page < data.pagination.total_pages ? <Link href={pageHref(data.pagination.page + 1)}>Siguiente</Link> : null}</div></nav> : null}
          </>
        )}
      </section>
    </div>
  );
}
