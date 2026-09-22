import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  DeviceIcon,
  LockIcon,
  ReceiptIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/icons";
import { StatusPill } from "@/features/workspace/staff-data-view";
import { getCollectionCase } from "@/lib/collection-cases";
import { formatStaffDate } from "@/lib/staff-data";
import { requireStaffPermission, STAFF_PERMISSIONS } from "@/lib/staff-session";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Detalle de cobranza | Teklease",
  description: "Detalle e historial de un estado de cobranza.",
};

function phaseTone(phase: number) {
  if (phase === 0) return "good" as const;
  if (phase <= 2) return "warning" as const;
  return "bad" as const;
}

function formatDateOnly(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Intl.DateTimeFormat("es-PY", { dateStyle: "medium" }).format(
    new Date(year, month - 1, day),
  );
}

function DataItem({ icon, label, children, tone }: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  tone?: "good" | "bad";
}) {
  return (
    <div className={styles.dataItem}>
      <span className={`${styles.dataIcon} ${tone ? styles[`dataIcon--${tone}`] : ""}`}>{icon}</span>
      <div><dt>{label}</dt><dd className={tone ? styles[`value--${tone}`] : undefined}>{children}</dd></div>
    </div>
  );
}

function eventTone(eventType: string) {
  if (eventType === "LOCK") return "bad" as const;
  if (eventType === "UNLOCK") return "good" as const;
  return "neutral" as const;
}

function EventIcon({ eventType }: { eventType: string }) {
  if (eventType === "LOCK") return <LockIcon />;
  if (eventType === "UNLOCK") return <CheckIcon />;
  return <ReceiptIcon />;
}

export default async function CollectionCaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  await requireStaffPermission(STAFF_PERMISSIONS.collectionCases);
  const caseId = Number((await params).caseId);
  if (!Number.isSafeInteger(caseId) || caseId <= 0) notFound();

  const result = await getCollectionCase(caseId);
  if (result.notFound) notFound();
  const collectionCase = result.case;

  if (!collectionCase) {
    return (
      <div className={`${styles.page} workspace-page`}>
        <Link className={styles.backLink} href="/panel/estado-cobranzas">← Volver a estados de cobranzas</Link>
        <div className={styles.error} role="alert">
          <strong>No se pudo cargar el detalle</strong>
          <p>{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} workspace-page`}>
      <nav className={styles.breadcrumb} aria-label="Migas de pan">
        <Link href="/panel">Dashboard</Link><ChevronRightIcon />
        <Link href="/panel/estado-cobranzas">Estado de cobranzas</Link><ChevronRightIcon />
        <span>Orden {collectionCase.odoo_order_id}</span>
      </nav>

      <header className={styles.header}>
        <div>
          <span>DETALLE DE COBRANZA</span>
          <h1>Orden Odoo {collectionCase.odoo_order_id}</h1>
          <p>Partner ID {collectionCase.odoo_partner_id} · IMEI {collectionCase.imei}</p>
        </div>
        <div className={styles.headerIcon}><ReceiptIcon /></div>
      </header>

      <div className={styles.topActions}>
        <Link href="/panel/estado-cobranzas">← Volver al listado</Link>
        <StatusPill label={collectionCase.phase_label} tone={phaseTone(collectionCase.phase)} />
      </div>

      <section className={styles.summary} aria-labelledby="summary-heading">
        <header className={styles.sectionHeading}>
          <span className={styles.sectionIcon}><ReceiptIcon /></span>
          <div><small>ESTADO ACTUAL</small><h2 id="summary-heading">Información completa</h2></div>
          <div className={`${styles.caseStatus} ${collectionCase.resolved_at ? styles.caseStatusResolved : ""}`}>
            <strong><i />{collectionCase.resolved_at ? "Resuelto" : "Abierto"}</strong>
            <span>Estado del caso</span>
          </div>
        </header>
        <dl>
          <DataItem icon={<ReceiptIcon />} label="Orden Odoo">{collectionCase.odoo_order_id}</DataItem>
          <DataItem icon={<UserIcon />} label="Partner ID">{collectionCase.odoo_partner_id}</DataItem>
          <DataItem icon={<DeviceIcon />} label="IMEI">{collectionCase.imei}</DataItem>
          <DataItem icon={<CheckIcon />} label="Estado" tone="good">{collectionCase.resolved_at ? "Resuelto" : "Abierto"}</DataItem>
          <DataItem icon={<BuildingIcon />} label="Sucursal">{collectionCase.sucursal || "Sin sucursal"}</DataItem>
          <DataItem icon={<UserIcon />} label="Operador">{collectionCase.operador || "Sin operador"}</DataItem>
          <DataItem icon={<PhoneIcon />} label="Número del operador">{collectionCase.numero_operador || "—"}</DataItem>
          <DataItem icon={<ReceiptIcon />} label="Facturas vencidas">{collectionCase.overdue_count}</DataItem>
          <DataItem icon={<PaymentIcon />} label="Pago reciente" tone={collectionCase.has_recent_payment ? "good" : "bad"}>{collectionCase.has_recent_payment ? "Sí" : "No"}</DataItem>
          <DataItem icon={<CalendarIcon />} label="Promesa de pago">{formatDateOnly(collectionCase.payment_promise_date)}</DataItem>
          <DataItem icon={<ShieldIcon />} label="Promesa vigente" tone={collectionCase.promise_is_valid ? "good" : "bad"}>{collectionCase.promise_is_valid ? "Sí" : "No"}</DataItem>
          <DataItem icon={<LockIcon />} label="Bloqueo solicitado" tone={collectionCase.is_lock_requested ? "bad" : "good"}>{collectionCase.is_lock_requested ? "Sí" : "No"}</DataItem>
          <DataItem icon={<ClockIcon />} label="Última evaluación">{formatStaffDate(collectionCase.last_evaluated_at)}</DataItem>
          <DataItem icon={<ReceiptIcon />} label="Resuelto">{formatStaffDate(collectionCase.resolved_at)}</DataItem>
          <DataItem icon={<CalendarIcon />} label="Creado">{formatStaffDate(collectionCase.created_at)}</DataItem>
          <DataItem icon={<ClockIcon />} label="Actualizado">{formatStaffDate(collectionCase.updated_at)}</DataItem>
        </dl>
      </section>

      <section className={styles.events} aria-labelledby="events-heading">
        <header className={styles.sectionHeading}>
          <span className={styles.sectionIcon}><TimelineIcon /></span>
          <div><small>HISTORIAL</small><h2 id="events-heading">Eventos de cobranzas</h2><p>Lista cronológica de eventos relacionados con esta orden.</p></div>
          <strong>{collectionCase.events.length} {collectionCase.events.length === 1 ? "evento" : "eventos"}</strong>
        </header>
        {collectionCase.events.length === 0 ? (
          <p className={styles.eventsEmpty}>Todavía no hay eventos registrados para esta orden.</p>
        ) : (
          <div className={styles.eventList}>
            {collectionCase.events.map((event) => (
              <div className={`${styles.timelineItem} ${styles[`timelineItem--${eventTone(event.event_type)}`]}`} key={event.id}>
                <i className={styles.timelineDot} />
                <article className={styles.event}>
                  <span className={styles.eventIcon}><EventIcon eventType={event.event_type} /></span>
                  <div className={styles.eventContent}>
                    <div className={styles.eventHeading}>
                      <div><strong>{event.event_type_label}</strong><small>{formatStaffDate(event.created_at)}</small></div>
                      <div className={styles.eventBadges}>
                        <span>{event.source_label}</span>
                        {event.execution ? <span>{event.execution.operation_label}</span> : null}
                      </div>
                    </div>
                    <p className={styles.eventKey}>{event.event_key}</p>
                    {event.message ? <p className={styles.eventMessage}>{event.message}</p> : null}
                    <div className={styles.eventMetadata}>
                      {event.execution ? <span>Ejecución #{event.execution.id} · {event.execution.status}</span> : null}
                      {event.job ? (
                        <span>
                          Resultado: {event.job.item_status_label ?? event.job.status_label}
                        </span>
                      ) : null}
                      {event.created_by ? (
                        <span>
                          Ejecutado por: {event.created_by.username}
                          {event.created_by.source === "policy" ? " · Simulación" : ""}
                        </span>
                      ) : null}
                      {event.message_job_id ? <span>Message job: {event.message_job_id}</span> : null}
                      {event.action_job_id ? <span>Action job: {event.action_job_id}</span> : null}
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BuildingIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 21V6l8-3v18M12 9h8v12M8 8v2M8 13v2M8 18v2M16 13v2M16 18v2M2 21h20" /></svg>;
}

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6.5 3h3l1.5 5-2 1.5a16 16 0 0 0 5.5 5.5l1.5-2 5 1.5v3a3 3 0 0 1-3 3A15 15 0 0 1 3.5 7a4 4 0 0 1 3-4Z" /></svg>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 17h2" /></svg>;
}

function PaymentIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></svg>;
}

function TimelineIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>;
}
