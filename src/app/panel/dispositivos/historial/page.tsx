import type { Metadata } from "next";
import { ExecutionHistory } from "@/features/mdm/execution-history";
import { hasStaffPermission, requireStaffPermission, STAFF_PERMISSIONS } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Historial de acciones MDM | Teklease" };

type HistoryPageProps = {
  searchParams: Promise<{ ejecucion?: string | string[]; filtro?: string | string[] }>;
};

export default async function DeviceHistoryPage({ searchParams }: HistoryPageProps) {
  const user = await requireStaffPermission(STAFF_PERMISSIONS.actionHistory);
  const { ejecucion, filtro } = await searchParams;
  const initialJobId = typeof ejecucion === "string" ? ejecucion : undefined;
  const initialAttentionOnly = filtro === "atencion";

  return <ExecutionHistory kind="actions" initialAttentionOnly={initialAttentionOnly} initialJobId={initialJobId} canRetry={hasStaffPermission(user, STAFF_PERMISSIONS.retryActions)} canCancel={hasStaffPermission(user, STAFF_PERMISSIONS.cancelActions)} />;
}
