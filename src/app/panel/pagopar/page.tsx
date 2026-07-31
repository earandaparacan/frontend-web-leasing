import type { Metadata } from "next";
import { ReceiptIcon } from "@/components/icons";
import { StaffDataView, StatusPill } from "@/features/workspace/staff-data-view";
import {
  firstQueryValue,
  formatStaffDate,
  getStaffCollection,
  type PagoparTransactionRecord,
} from "@/lib/staff-data";

export const metadata: Metadata = {
  title: "Transacciones Pagopar | Teklease",
  description: "Consulta de transacciones Pagopar de Teklease.",
};

const statusOptions = [
  { value: "initiating", label: "Iniciando" },
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "reversed", label: "Reversado" },
  { value: "failed", label: "Fallido" },
  { value: "odoo_error", label: "Error en Odoo" },
];

function paymentTone(status: string) {
  if (status === "paid") return "good" as const;
  if (["initiating", "pending"].includes(status)) return "warning" as const;
  if (["reversed", "failed", "odoo_error"].includes(status)) return "bad" as const;
  return "neutral" as const;
}

function formatAmount(value: string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PYG" ? 0 : 2,
  }).format(amount);
}

export default async function PagoparTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstQueryValue(params.search);
  const status = firstQueryValue(params.status);
  const page = firstQueryValue(params.page);
  const data = await getStaffCollection<PagoparTransactionRecord>(
    "/api/v1/staff/payments/pagopar",
    { search, status, page },
  );

  return (
    <StaffDataView
      basePath="/panel/pagopar"
      eyebrow="PAGOS"
      title="Transacciones Pagopar"
      description="Seguí pagos, referencias y estados de las operaciones procesadas mediante Pagopar."
      icon={ReceiptIcon}
      columns={["Orden", "Factura", "Cliente Odoo", "Importe", "Estado", "Fecha"]}
      rows={data.results.map((transaction) => ({
        id: transaction.id,
        cells: [
          <span key="order"><strong>{transaction.merchant_order_id}</strong><small>{transaction.receipt_number || "Sin recibo"}</small></span>,
          <span key="invoice"><strong>{transaction.invoice_name}</strong><small>ID {transaction.odoo_invoice_id}</small></span>,
          transaction.odoo_partner_id,
          <strong key="amount">{formatAmount(transaction.amount, transaction.currency)}</strong>,
          <StatusPill key="status" label={transaction.status_label} tone={paymentTone(transaction.status)} />,
          <span key="date"><strong>{formatStaffDate(transaction.paid_at ?? transaction.created_at)}</strong><small>{transaction.payment_method || "Sin método"}</small></span>,
        ],
      }))}
      pagination={data.pagination}
      search={search}
      searchPlaceholder="Buscar orden, factura, recibo o partner..."
      filterName="status"
      filterLabel="Estado"
      filterValue={status}
      filterOptions={statusOptions}
      emptyTitle="No hay transacciones Pagopar"
      emptyDescription="No se encontraron operaciones con los filtros actuales."
      error={data.error}
    />
  );
}
