import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  DeviceIcon,
  LockIcon,
  ReceiptIcon,
  ShieldIcon,
} from "@/components/icons";
import { StatusPill } from "@/features/workspace/staff-data-view";
import {
  getCollectionCases,
  type CollectionCase,
  type CollectionCasesSummary,
} from "@/lib/collection-cases";
import { firstQueryValue, formatStaffDate } from "@/lib/staff-data";
import { requireStaffPermission, STAFF_PERMISSIONS } from "@/lib/staff-session";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Estado de cobranzas | Teklease",
  description: "Consulta del estado actual de cobranzas por orden, cliente o IMEI.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function phaseTone(phase: number) {
  if (phase === 0) return "good" as const;
  if (phase <= 2) return "warning" as const;
  return "bad" as const;
}

function pageHref(
  page: number,
  filters: Record<string, string>,
) {
  const query = new URLSearchParams({ ...filters, page: String(page) });
  return `/panel/estado-cobranzas?${query}`;
}

function SummaryItem({
  icon,
  label,
  children,
  tone,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  tone?: "good";
}) {
  return (
    <div className={styles.summaryItem}>
      <span className={`${styles.summaryIcon} ${tone ? styles[`summaryIcon--${tone}`] : ""}`}>
        {icon}
      </span>
      <div>
        <span>{label}</span>
        <strong className={tone ? styles[`summaryValue--${tone}`] : undefined}>{children}</strong>
      </div>
    </div>
  );
}

const PHASES = [
  { key: "0", label: "Al día" },
  { key: "1", label: "Fase 1" },
  { key: "2", label: "Fase 2" },
  { key: "3", label: "Fase 3" },
  { key: "4", label: "Fase 4" },
] as const;

function MetricCard({
  icon,
  label,
  value,
  description,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  description: string;
  tone?: "neutral" | "good" | "warning" | "bad";
}) {
  return (
    <article className={`${styles.metricCard} ${styles[`metricCard--${tone}`]}`}>
      <span className={styles.metricIcon}>{icon}</span>
      <div><span>{label}</span><strong>{value.toLocaleString("es-PY")}</strong><small>{description}</small></div>
    </article>
  );
}

function CollectionsDashboard({ summary }: { summary: CollectionCasesSummary }) {
  return (
    <section className={styles.dashboard} aria-labelledby="dashboard-heading">
      <header>
        <div><span>RESUMEN GENERAL</span><h2 id="dashboard-heading">Panorama de cobranzas</h2></div>
        <small>Datos actuales de todas las órdenes</small>
      </header>
      <div className={styles.metrics}>
        <MetricCard icon={<ReceiptIcon />} label="Órdenes totales" value={summary.total} description="Incluye activas y resueltas" />
        <MetricCard icon={<CheckIcon />} label="Órdenes activas" value={summary.active} description="Pendientes de resolución" tone="good" />
        <MetricCard icon={<AlertTriangleIcon />} label="Casos críticos" value={summary.critical} description="Órdenes en fases 3 y 4" tone="bad" />
        <MetricCard icon={<LockIcon />} label="Bloqueos solicitados" value={summary.lock_requested} description="Solicitudes activas de bloqueo" tone="warning" />
        <MetricCard icon={<ShieldIcon />} label="Promesas vigentes" value={summary.valid_promises} description="Órdenes con compromiso válido" tone="good" />
      </div>
      <div className={styles.phaseSummary}>
        <span>Distribución de órdenes activas</span>
        <div>
          {PHASES.map((phase) => (
            <span key={phase.key}><small>{phase.label}</small><strong>{summary.phases[phase.key].toLocaleString("es-PY")}</strong></span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CaseCard({ collectionCase }: { collectionCase: CollectionCase }) {
  return (
    <article className={styles.caseCard}>
      <header>
        <div>
          <span>ORDEN ODOO</span>
          <h2>{collectionCase.odoo_order_id}</h2>
          <small>Partner ID {collectionCase.odoo_partner_id}</small>
        </div>
        <StatusPill
          label={collectionCase.phase_label}
          tone={phaseTone(collectionCase.phase)}
        />
      </header>

      <div className={styles.primaryData}>
        <SummaryItem icon={<DeviceIcon />} label="IMEI">{collectionCase.imei}</SummaryItem>
        <SummaryItem icon={<ReceiptIcon />} label="Facturas vencidas">{collectionCase.overdue_count}</SummaryItem>
        <SummaryItem icon={<CheckIcon />} label="Estado" tone="good">
          {collectionCase.resolved_at ? "Resuelto" : "Activo"}
        </SummaryItem>
        <SummaryItem icon={<ClockIcon />} label="Última evaluación">
          {formatStaffDate(collectionCase.last_evaluated_at)}
        </SummaryItem>
      </div>

      <footer className={styles.caseActions}>
        <Link href={`/panel/estado-cobranzas/${collectionCase.id}`}>Ver detalle completo</Link>
      </footer>
    </article>
  );
}

export default async function CollectionCasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireStaffPermission(STAFF_PERMISSIONS.collectionCases);
  const params = await searchParams;
  const filters = {
    search: firstQueryValue(params.search),
    search_by: firstQueryValue(params.search_by) || "all",
    phase: firstQueryValue(params.phase),
    status: firstQueryValue(params.status) || "active",
  };
  const data = await getCollectionCases({
    ...filters,
    page: firstQueryValue(params.page),
  });

  return (
    <div className={`${styles.page} workspace-page`}>
      <nav className={styles.breadcrumb} aria-label="Migas de pan">
        <Link href="/panel">Dashboard</Link><ChevronRightIcon /><span>Estado de cobranzas</span>
      </nav>

      <header className={styles.header}>
        <div>
          <span>CONTROL DE COBRANZAS</span>
          <h1>Estado de cobranzas</h1>
          <p>Consultá la situación más reciente de una orden por IMEI, Partner ID u Order ID.</p>
        </div>
        <div className={styles.headerIcon}><ReceiptIcon /></div>
      </header>

      {!data.error ? <CollectionsDashboard summary={data.summary} /> : null}

      <section className={styles.content} aria-labelledby="results-heading">
        <form className={styles.filters} method="get">
          <label className={styles.searchField}>
            <span>Identificador</span>
            <input
              name="search"
              defaultValue={filters.search}
              inputMode="numeric"
              placeholder="Ingresá IMEI, Partner ID u Order ID"
            />
          </label>
          <label><span>Buscar por</span><select name="search_by" defaultValue={filters.search_by}>
            <option value="all">Todos</option>
            <option value="imei">IMEI</option>
            <option value="partner_id">Partner ID</option>
            <option value="order_id">Order ID</option>
          </select></label>
          <label><span>Fase</span><select name="phase" defaultValue={filters.phase}>
            <option value="">Todas</option>
            <option value="0">Sin mora</option>
            <option value="1">Fase 1</option>
            <option value="2">Fase 2</option>
            <option value="3">Fase 3</option>
            <option value="4">Fase 4</option>
          </select></label>
          <label><span>Estado</span><select name="status" defaultValue={filters.status}>
            <option value="active">Activos</option>
            <option value="resolved">Resueltos</option>
            <option value="all">Todos</option>
          </select></label>
          <button type="submit">Buscar</button>
          <Link href="/panel/estado-cobranzas">Limpiar</Link>
        </form>

        <div className={styles.resultsHeader}>
          <div><span>REGISTROS</span><h2 id="results-heading">Resultados</h2></div>
          <strong>{data.pagination.total} en total</strong>
        </div>

        {data.error ? (
          <div className={styles.feedback} role="alert"><strong>No se pudieron cargar los estados</strong><p>{data.error}</p></div>
        ) : data.results.length === 0 ? (
          <div className={styles.feedback}><ReceiptIcon /><strong>No encontramos estados de cobranza</strong><p>Revisá el identificador o modificá los filtros de búsqueda.</p></div>
        ) : (
          <div className={styles.caseList}>{data.results.map((item) => <CaseCard key={item.id} collectionCase={item} />)}</div>
        )}

        {!data.error && data.pagination.total_pages > 1 ? (
          <nav className={styles.pagination} aria-label="Paginación">
            <span>Página {data.pagination.page} de {data.pagination.total_pages}</span>
            <div>
              {data.pagination.page > 1 ? <Link href={pageHref(data.pagination.page - 1, filters)}>Anterior</Link> : null}
              {data.pagination.page < data.pagination.total_pages ? <Link href={pageHref(data.pagination.page + 1, filters)}>Siguiente</Link> : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
