import type { Metadata } from "next";
import { ReceiptIcon } from "@/components/icons";
import { StaffDataView, StatusPill } from "@/features/workspace/staff-data-view";
import {
  firstQueryValue,
  formatStaffDate,
  getStaffCollection,
  type OdooPaymentEventRecord,
} from "@/lib/staff-data";
import { requireStaffPermission, STAFF_PERMISSIONS } from "@/lib/staff-session";

export const metadata: Metadata = {
  title: "Eventos de pago Odoo | Teklease",
  description: "Consulta de eventos de pago Odoo de Teklease.",
};

const eventTypeOptions = [
  { value: "payment", label: "Pago" },
  { value: "payment_promise", label: "Promesa de pago" },
];

function eventTone(status: string) {
  if (status === "UNLOCK_QUEUED") return "good" as const;
  if (status === "ACCEPTED") return "info" as const;
  return "neutral" as const;
}

function eventTypeLabel(eventType: string) {
  return eventType === "payment_promise" ? "Promesa de pago" : "Pago";
}

function stateLabel(state: string) {
  return state === "in_process" ? "En proceso" : "Publicado";
}

function statusLabel(status: string) {
  return status === "UNLOCK_QUEUED" ? "Desbloqueo en cola" : "Aceptado";
}

export default async function OdooPaymentEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaffPermission(STAFF_PERMISSIONS.odooPaymentEvents);
  const params = await searchParams;
  const search = firstQueryValue(params.search);
  const eventType = firstQueryValue(params.event_type);
  const page = firstQueryValue(params.page);
  const data = await getStaffCollection<OdooPaymentEventRecord>(
    "/api/v1/staff/payments/odoo-events",
    { search, event_type: eventType, page },
  );

  return (
    <StaffDataView
      basePath="/panel/odoo-payment-events"
      eyebrow="INTEGRACIONES"
      title="Eventos de pago Odoo"
      description="Revisá pagos y promesas de pago que originaron acciones de desbloqueo en MDM."
      icon={ReceiptIcon}
      columns={["Evento", "Tipo", "Cliente", "Dispositivos", "Resultado", "Fecha"]}
      rows={data.results.map((event) => ({
        id: String(event.id),
        cells: [
          <span key="event"><strong>{event.event_id}</strong><small>Odoo {event.odoo_id} · {stateLabel(event.state)}</small></span>,
          <span key="type"><strong>{eventTypeLabel(event.event_type)}</strong><small>{event.promise_date ? `Promesa: ${event.promise_date}` : "Sin fecha de promesa"}</small></span>,
          <span key="customer"><strong>{event.customer_name || "Cliente sin nombre"}</strong><small>{event.triggered_by_user_name || "Origen automático"}</small></span>,
          <span key="devices"><strong>{event.device_count}</strong><small>{event.imeis[0] || "Sin IMEI"}{event.device_count > 1 ? ` y ${event.device_count - 1} más` : ""}</small></span>,
          <StatusPill key="status" label={statusLabel(event.status)} tone={eventTone(event.status)} />,
          <span key="date"><strong>{formatStaffDate(event.created_at)}</strong><small>{event.action_job_id ? `Job ${event.action_job_id}` : "Sin job MDM"}</small></span>,
        ],
      }))}
      pagination={data.pagination}
      search={search}
      searchPlaceholder="Buscar evento, cliente, IMEI o usuario..."
      filterName="event_type"
      filterLabel="Tipo"
      filterValue={eventType}
      filterOptions={eventTypeOptions}
      emptyTitle="No hay eventos de pago Odoo"
      emptyDescription="No se encontraron eventos con los filtros actuales."
      error={data.error}
    />
  );
}
