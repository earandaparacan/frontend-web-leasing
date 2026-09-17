import type { Metadata } from "next";
import { ReceiptIcon } from "@/components/icons";
import { StaffDataView, StatusPill } from "@/features/workspace/staff-data-view";
import {
  firstQueryValue,
  formatStaffDate,
  getStaffCollection,
  type InfonetTransactionRecord,
} from "@/lib/staff-data";
import { requireStaffPermission, STAFF_PERMISSIONS } from "@/lib/staff-session";

export const metadata: Metadata = {
  title: "Transacciones Infonet | Teklease",
  description: "Consulta de transacciones Infonet de Teklease.",
};

const statusOptions = [
  { value: "received", label: "Recibido" },
  { value: "processing", label: "Procesando" },
  { value: "processed", label: "Procesado" },
  { value: "failed", label: "Fallido" },
  { value: "reversed", label: "Reversado" },
];

function transactionTone(status: string) {
  if (status === "processed") return "good" as const;
  if (["received", "processing"].includes(status)) return "warning" as const;
  if (["failed", "reversed"].includes(status)) return "bad" as const;
  return "neutral" as const;
}

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PYG" ? 0 : 2,
  }).format(value);
}

export default async function InfonetTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaffPermission(STAFF_PERMISSIONS.infonet);
  const params = await searchParams;
  const search = firstQueryValue(params.search);
  const status = firstQueryValue(params.status);
  const page = firstQueryValue(params.page);
  const data = await getStaffCollection<InfonetTransactionRecord>(
    "/api/v1/staff/payments/infonet",
    { search, status, page },
  );

  return (
    <StaffDataView
      basePath="/panel/infonet"
      eyebrow="PAGOS"
      title="Transacciones Infonet"
      description="Consultá pagos, referencias de Odoo y estados de las operaciones procesadas mediante Infonet."
      icon={ReceiptIcon}
      columns={["TID", "Factura", "Abonado", "Importe", "Estado", "Fecha"]}
      rows={data.results.map((transaction) => ({
        id: String(transaction.id),
        cells: [
          <span key="tid"><strong>{transaction.tid}</strong><small>Producto Infonet</small></span>,
          <span key="invoice"><strong>{transaction.odoo_invoice_name || transaction.invoice_id}</strong><small>Pago Odoo {transaction.odoo_payment_id ?? "sin registrar"}</small></span>,
          <span key="subscriber"><strong>{transaction.subscriber_id}</strong><small>Partner {transaction.odoo_partner_id ?? "sin identificar"}</small></span>,
          <strong key="amount">{formatAmount(transaction.amount, transaction.currency)}</strong>,
          <StatusPill key="status" label={transaction.status_label} tone={transactionTone(transaction.status)} />,
          <span key="date"><strong>{formatStaffDate(transaction.paid_at ?? transaction.created_at)}</strong><small>{transaction.transaction_date} · {transaction.transaction_time}</small></span>,
        ],
      }))}
      pagination={data.pagination}
      search={search}
      searchPlaceholder="Buscar TID, abonado, factura o pago Odoo..."
      filterName="status"
      filterLabel="Estado"
      filterValue={status}
      filterOptions={statusOptions}
      emptyTitle="No hay transacciones Infonet"
      emptyDescription="No se encontraron operaciones con los filtros actuales."
      error={data.error}
    />
  );
}
