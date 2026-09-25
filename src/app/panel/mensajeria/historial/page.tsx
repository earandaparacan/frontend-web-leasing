import type { Metadata } from "next";
import { ExecutionHistory } from "@/features/mdm/execution-history";
import { hasStaffPermission, requireStaffPermission, STAFF_PERMISSIONS } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Historial de mensajería MDM | Teklease" };

type HistoryPageProps = { searchParams: Promise<{ ejecucion?: string | string[] }> };

export default async function MessageHistoryPage({ searchParams }: HistoryPageProps) {
  const user = await requireStaffPermission(STAFF_PERMISSIONS.messageHistory);
  const { ejecucion } = await searchParams;
  const initialJobId = typeof ejecucion === "string" ? ejecucion : undefined;

  return <ExecutionHistory kind="messages" initialJobId={initialJobId} currentUsername={user.username} canRetry={hasStaffPermission(user, STAFF_PERMISSIONS.retryMessages)} canCancel={false} />;
}
