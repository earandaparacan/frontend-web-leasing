import type { Metadata } from "next";
import { getOperationalDashboard } from "@/lib/operational-dashboard";
import { getStaffUser } from "@/lib/staff-session";
import styles from "./panel.module.css";

export const metadata: Metadata = {
  title: "Dashboard | Teklease",
  description: "Centro de control operativo del portal administrativo de Teklease.",
};

function formatDate(value: string | undefined) {
  if (!value) return "Datos no disponibles";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Datos no disponibles";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function metricValue(value: number | null | undefined) {
  return typeof value === "number" ? new Intl.NumberFormat("es-PY").format(value) : "—";
}

function statusTone(status: string) {
  if (status === "FAILED") return "critical";
  if (status === "PARTIAL_SUCCESS") return "warning";
  if (["QUEUED", "RUNNING"].includes(status)) return "info";
  return "success";
}

export default async function PanelPage() {
  const [user, result] = await Promise.all([getStaffUser(), getOperationalDashboard()]);
  const dashboard = result.dashboard;
  const summary = dashboard?.summary;
  const metrics = [
    {
      label: "Flota MDM",
      value: metricValue(summary?.mdm_devices),
      detail:
        summary?.mdm_without_configuration === null || summary?.mdm_without_configuration === undefined
          ? "Métrica temporalmente no disponible"
          : `${metricValue(summary.mdm_without_configuration)} sin configuración`,
      tone: "orange",
    },
    {
      label: "Bloqueados / desbloqueados",
      value: `${metricValue(summary?.mdm_locked)} / ${metricValue(summary?.mdm_unlocked)}`,
      detail:
        summary?.mdm_lock_status_unknown === null || summary?.mdm_lock_status_unknown === undefined
          ? "Estado actual informado por Device Reset"
          : `${metricValue(summary.mdm_lock_status_unknown)} sin estado en Device Reset`,
      tone: "red",
    },
    {
      label: "Equipos sin reporte",
      value: metricValue(summary?.mdm_without_report_24h),
      detail:
        summary?.mdm_without_report_7d === null || summary?.mdm_without_report_7d === undefined
          ? "Métrica temporalmente no disponible"
          : `${metricValue(summary.mdm_without_report_7d)} sin reporte hace 7 días`,
      tone: "red",
    },
  ] as const;

  return (
    <div className={styles.page}>
      <section className={styles.welcome}>
        <div>
          <span className={styles.eyebrow}>CENTRO DE CONTROL</span>
          <h1>Panel operativo</h1>
          <p>Hola, {user.username}. Priorizá lo que requiere atención y seguí las operaciones en curso.</p>
        </div>
        <div className={styles.status}>
          <span />
          <div>
            <strong>{dashboard ? "Datos actualizados" : "Datos no disponibles"}</strong>
            <small>{dashboard ? formatDate(dashboard.generated_at) : "Reintentá en unos minutos"}</small>
          </div>
        </div>
      </section>

      {result.error ? <p className={styles.errorNotice} role="alert">{result.error}</p> : null}

      <section aria-labelledby="overview-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span>VISTA GENERAL</span>
            <h2 id="overview-heading">Situación actual</h2>
          </div>
        </div>

        <div className={styles.metricGrid}>
          {metrics.map((metric) => (
            <article className={`${styles.metricCard} ${styles[`metricCard--${metric.tone}`]}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.mdmMovements} aria-labelledby="movements-heading">
        <article className={styles.executionCard}>
          <div className={styles.cardHeading}>
            <div>
              <span>EJECUCIONES</span>
              <h2 id="movements-heading">Últimos movimientos MDM</h2>
            </div>
          </div>

          {dashboard?.executions.length ? (
            <div className={styles.executionList}>
              {dashboard.executions.map((execution) => (
                <div className={styles.executionItem} key={execution.id}>
                  <div>
                    <strong>{execution.title}</strong>
                    <small>{execution.detail} · {formatDate(execution.created_at)}</small>
                  </div>
                  <span className={`${styles.statusPill} ${styles[`statusPill--${statusTone(execution.status)}`]}`}>
                    {execution.status_label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyCopy}>Todavía no hay movimientos MDM para mostrar.</p>
          )}
        </article>
      </section>
    </div>
  );
}
