import type { Metadata } from "next";
import { ExecutionHistory } from "@/features/mdm/execution-history";

export const metadata: Metadata = { title: "Historial de acciones MDM | Teklease" };

type HistoryPageProps = { searchParams: Promise<{ ejecucion?: string | string[] }> };

export default async function DeviceHistoryPage({ searchParams }: HistoryPageProps) {
  const { ejecucion } = await searchParams;
  const initialJobId = typeof ejecucion === "string" ? ejecucion : undefined;

  return <ExecutionHistory kind="actions" initialJobId={initialJobId} />;
}
