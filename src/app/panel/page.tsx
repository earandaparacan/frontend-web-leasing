import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangleIcon,
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  DeviceIcon,
  InfoIcon,
  LockIcon,
  MessageIcon,
  RefreshIcon,
  ShieldIcon,
} from "@/components/icons";
import { getOperationalDashboard } from "@/lib/operational-dashboard";
import { getStaffUser } from "@/lib/staff-session";
import styles from "./panel.module.css";

export const metadata: Metadata = {
  title: "Dashboard | Teklease",
  description: "Centro de control operativo del portal administrativo de Teklease.",
};

type AttentionItem = {
  severity: "critical" | "warning";
  title: string;
  href: string;
};

function formatUpdatedAt(value: string | undefined) {
  if (!value) return "Datos no disponibles";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Datos no disponibles";

  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Hace instantes";
  if (minutes < 60) return `Hace ${minutes} min`;

  return `Hace ${Math.round(minutes / 60)} h`;
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

function executionIcon(type: string) {
  if (type.includes("message")) return MessageIcon;
  if (type.includes("lock") || type.includes("unlock")) return LockIcon;

  return DeviceIcon;
}

function executionDetailHref(type: string, id: string) {
  const isMessage = type.toLowerCase().includes("message");
  const historyPath = isMessage
    ? "/panel/mensajeria/historial"
    : "/panel/dispositivos/historial";
  const prefixedId = `${isMessage ? "message" : "action"}-`;
  const jobId = id.startsWith(prefixedId) ? id.slice(prefixedId.length) : id;

  return `${historyPath}?ejecucion=${encodeURIComponent(jobId)}`;
}

export default async function PanelPage() {
  const [user, result] = await Promise.all([getStaffUser(), getOperationalDashboard()]);
  const dashboard = result.dashboard;
  const summary = dashboard?.summary;
  const metrics = [
    {
      label: "Flota MDM",
      value: metricValue(summary?.mdm_devices),
      detail: `${metricValue(summary?.mdm_devices)} equipos administrados`,
      helpText: "Cantidad total de equipos que la empresa administra desde esta plataforma. Permite conocer el tamaño de la flota bajo control.",
      helpDetail: "Incluye dispositivos activos y en gestión.",
      tone: "orange",
      isPositive: true,
    },
    {
      label: "Bloqueados / desbloqueados",
      value: `${metricValue(summary?.mdm_locked)} / ${metricValue(summary?.mdm_unlocked)}`,
      detail: `${metricValue(summary?.mdm_action_attention)} operaciones requieren seguimiento`,
      helpText: "Resume el último estado de bloqueo informado por los dispositivos; no representa su disponibilidad u operatividad actual.",
      helpDetail: "Refleja el estado operativo más reciente de los equipos.",
      tone: "purple",
      isPositive: false,
    },
    {
      label: "Sin reporte en las últimas 24 h",
      value: metricValue(summary?.mdm_without_report_24h),
      detail: `${metricValue(summary?.mdm_without_report_7d)} sin reporte hace 7 días`,
      helpText: "Equipos que no se han comunicado con la plataforma en las últimas 24 horas. Si pasan 7 días sin reportar, conviene revisarlos porque podrían estar sin conexión, apagados o fuera de uso.",
      helpDetail: "Ayuda a priorizar los equipos que requieren seguimiento.",
      tone: "red",
      isPositive: false,
    },
  ] as const;

  const priorityAlerts: AttentionItem[] = [];
  if ((summary?.mdm_without_report_7d ?? 0) > 0) {
    priorityAlerts.push({
      severity: "critical",
      title: `${metricValue(summary?.mdm_without_report_7d)} equipos sin reporte hace 7 días`,
      href: "/panel/equipos-sin-reporte?tipo=sin-reporte-7d",
    });
  }
  if ((summary?.mdm_action_attention ?? 0) > 0) {
    priorityAlerts.push({
      severity: "warning",
      title: `${metricValue(summary?.mdm_action_attention)} operaciones de bloqueo por revisar`,
      href: "/panel/dispositivos/historial?filtro=atencion",
    });
  }
  for (const alert of dashboard?.alerts ?? []) {
    const severity = alert.severity.toLowerCase() === "critical" ? "critical" : "warning";
    priorityAlerts.push({ severity, title: alert.title, href: alert.href });
  }
  const attentionItems = priorityAlerts.slice(0, 2);

  return (
    <div className={`${styles.page} workspace-page`} data-dashboard>
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
            <small>{dashboard ? formatUpdatedAt(dashboard.generated_at) : "Reintentá en unos minutos"}</small>
          </div>
          <RefreshIcon />
        </div>
      </section>

      {result.error ? <p className={styles.errorNotice} role="alert">{result.error}</p> : null}

      <section aria-labelledby="overview-heading">
        <div className={styles.sectionHeading}>
          <h2 id="overview-heading">Situación actual</h2>
        </div>
        <div className={styles.metricGrid}>
          {metrics.map((metric) => (
            <article className={`${styles.metricCard} ${styles[`metricCard--${metric.tone}`]}`} key={metric.label}>
              <span className={styles.metricIcon}>
                {metric.tone === "orange" ? <DeviceIcon /> : metric.tone === "purple" ? <LockIcon /> : <AlertTriangleIcon />}
              </span>
              <div className={styles.metricContent}>
                <span className={styles.metricLabel}>
                  {metric.label}
                  <span className={`${styles.tooltipWrapper} ${styles[`tooltipWrapper--${metric.tone}`]}`}>
                    <button
                      aria-describedby={`metric-help-${metric.tone}`}
                      aria-label={`Más información sobre ${metric.label}`}
                      className={styles.tooltip}
                      type="button"
                    >
                      <InfoIcon />
                    </button>
                    <span className={styles.tooltipPanel} id={`metric-help-${metric.tone}`} role="tooltip">
                      <span className={styles.tooltipSection}>
                        <span className={styles.tooltipIcon}><InfoIcon /></span>
                        <span>
                          <strong>Sobre {metric.label}</strong>
                          <span>{metric.helpText}</span>
                        </span>
                      </span>
                      <span className={styles.tooltipDivider} />
                      <span className={styles.tooltipSection}>
                        <span className={styles.tooltipIcon}><ShieldIcon /></span>
                        <span>{metric.helpDetail}</span>
                      </span>
                    </span>
                  </span>
                </span>
                <strong>{metric.value}</strong>
                <small className={metric.isPositive ? styles.metricDetailPositive : undefined}>
                  {metric.isPositive ? <CheckIcon /> : null}
                  {metric.detail}
                </small>
              </div>
              {metric.tone === "red" ? <Link href="/panel/equipos-sin-reporte">Revisar equipos <ChevronRightIcon /></Link> : null}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.operationGrid}>
        <article className={styles.alertCard} aria-labelledby="attention-heading">
          <div className={styles.cardHeading}>
            <BellIcon />
            <h2 id="attention-heading">Requiere atención</h2>
          </div>
          {attentionItems.length ? (
            <div className={styles.alertList}>
              {attentionItems.map((alert) => (
                <Link
                  className={`${styles.alertItem} ${alert.severity === "warning" ? styles.alertItemWarning : ""}`}
                  href={alert.href}
                  key={`${alert.href}-${alert.title}`}
                >
                  <span className={styles.alertIcon}>
                    {alert.severity === "critical" ? <AlertTriangleIcon /> : <ClockIcon />}
                  </span>
                  <div>
                    <strong>{alert.title}</strong>
                    <small>{alert.severity === "critical" ? "Crítico" : "Pendiente"}</small>
                  </div>
                  <span className={styles.alertAction}>{alert.severity === "critical" ? "Ver equipos" : "Revisar"}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.cleanState}>
              <span><CheckIcon /></span>
              <div><strong>Todo bajo control</strong><p>No hay alertas operativas pendientes.</p></div>
            </div>
          )}
        </article>

        <article className={styles.executionCard} aria-labelledby="movements-heading">
          <div className={styles.cardHeading}>
            <ClockIcon />
            <h2 id="movements-heading">Últimos movimientos MDM</h2>
            <select aria-label="Filtrar operaciones" defaultValue="all">
              <option value="all">Todas las operaciones</option>
            </select>
          </div>
          {dashboard?.executions.length ? (
            <div className={styles.executionList}>
              {dashboard.executions.slice(0, 4).map((execution) => {
                const Icon = executionIcon(execution.type);
                return (
                  <Link className={styles.executionItem} href={executionDetailHref(execution.type, execution.id)} key={execution.id}>
                    <span className={styles.executionIcon}><Icon /></span>
                    <div><strong>{execution.title}</strong><small>{formatUpdatedAt(execution.created_at)} · {execution.detail}</small></div>
                    <span className={`${styles.statusPill} ${styles[`statusPill--${statusTone(execution.status)}`]}`}>{execution.status_label}</span>
                    <ChevronRightIcon />
                  </Link>
                );
              })}
            </div>
          ) : <p className={styles.emptyCopy}>Todavía no hay movimientos MDM para mostrar.</p>}
          <Link className={styles.historyLink} href="/panel/dispositivos/historial">Ver historial completo <ChevronRightIcon /></Link>
        </article>
      </section>
    </div>
  );
}
