import type { Metadata } from "next";
import { ExecutionHistory } from "@/features/mdm/execution-history";

export const metadata: Metadata = { title: "Historial de acciones MDM | Teklease" };

type HistoryPageProps = {
  searchParams: Promise<{ ejecucion?: string | string[]; filtro?: string | string[] }>;
};

export default async function DeviceHistoryPage({ searchParams }: HistoryPageProps) {
  const { ejecucion, filtro } = await searchParams;
  const initialJobId = typeof ejecucion === "string" ? ejecucion : undefined;
  const initialAttentionOnly = filtro === "atencion";

  return <ExecutionHistory kind="actions" initialAttentionOnly={initialAttentionOnly} initialJobId={initialJobId} />;
}
