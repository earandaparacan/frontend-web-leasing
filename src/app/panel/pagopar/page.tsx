import type { Metadata } from "next";
import { ReceiptIcon } from "@/components/icons";
import { ModulePlaceholder } from "@/features/workspace/module-placeholder";

export const metadata: Metadata = {
  title: "Transacciones Pagopar | Teklease",
  description: "Consulta de transacciones Pagopar de Teklease.",
};

export default function PagoparTransactionsPage() {
  return (
    <ModulePlaceholder
      eyebrow="PAGOS"
      title="Transacciones Pagopar"
      description="Seguí pagos, referencias y estados de las operaciones procesadas mediante Pagopar."
      emptyTitle="No hay transacciones para mostrar"
      emptyDescription="La estructura del módulo está lista. Las transacciones aparecerán cuando se conecte la integración de Pagopar."
      icon={ReceiptIcon}
      columns={["Referencia", "Usuario", "Importe", "Estado"]}
    />
  );
}
