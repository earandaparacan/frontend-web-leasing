import { fetchOdooMonitorReport } from "@/lib/odoo-monitor-backend";
import { MonitorOdoo } from "@/features/monitor-odoo/monitor-odoo";

export const metadata = {
  title: "Monitor Odoo MDM | Teklease",
  description: "Monitor de elegibilidad, promesas de pago y bloqueos MDM en tiempo real.",
};

export default async function MonitorOdooPage() {
  const initialData = await fetchOdooMonitorReport(false);

  return <MonitorOdoo initialData={initialData} />;
}
