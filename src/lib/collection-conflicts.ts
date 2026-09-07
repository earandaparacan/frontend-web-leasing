import "server-only";
import { cookies } from "next/headers";
import { getBackendUrl, readBackendJson } from "@/lib/backend";
import type { Pagination } from "@/lib/staff-data";

type ConflictOrder = {
  order_id: number;
  order_name: string;
  partner_id: number | null;
  partner_name: string;
  phase: number;
  overdue_count: number;
  sucursal: string;
  operador: string;
};

export type ImeiConflict = {
  id: string;
  imei: string;
  kind: "cross_customer" | "same_customer";
  orders: ConflictOrder[];
  order_count: number;
  customer_count: number;
  execution_id: number;
  detected_at: string;
  dry_run: boolean;
};

type ConflictScan = {
  execution_id: number;
  detected_at: string;
  dry_run: boolean;
  scope: { plan_id?: number; subscription_state?: string };
  device_count: number;
  order_count: number;
};

type ConflictPayload = {
  results: ImeiConflict[];
  pagination: Pagination;
  latest_scan: ConflictScan | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOrder(value: unknown): value is ConflictOrder {
  return isObject(value) && typeof value.order_id === "number" &&
    (value.partner_id === null || typeof value.partner_id === "number") &&
    typeof value.phase === "number" && typeof value.overdue_count === "number" &&
    ["order_name", "partner_name", "sucursal", "operador"].every((key) => typeof value[key] === "string");
}

function isConflict(value: unknown): value is ImeiConflict {
  return isObject(value) && typeof value.id === "string" && typeof value.imei === "string" &&
    ["cross_customer", "same_customer"].includes(String(value.kind)) &&
    typeof value.order_count === "number" && typeof value.customer_count === "number" &&
    typeof value.execution_id === "number" && typeof value.detected_at === "string" &&
    typeof value.dry_run === "boolean" && Array.isArray(value.orders) && value.orders.every(isOrder);
}

function isPayload(value: unknown): value is ConflictPayload {
  if (!isObject(value) || !Array.isArray(value.results) || !value.results.every(isConflict)) return false;
  const pagination = value.pagination;
  if (!isObject(pagination) || !["page", "page_size", "total", "total_pages"].every((key) =>
    typeof pagination[key] === "number" && Number.isInteger(pagination[key]) && Number(pagination[key]) >= 0)) return false;
  const scan = value.latest_scan;
  return scan === null || (isObject(scan) && typeof scan.execution_id === "number" &&
    typeof scan.detected_at === "string" && typeof scan.dry_run === "boolean" &&
    typeof scan.device_count === "number" && typeof scan.order_count === "number" &&
    isObject(scan.scope) && (scan.scope.plan_id === undefined || typeof scan.scope.plan_id === "number") &&
    (scan.scope.subscription_state === undefined || typeof scan.scope.subscription_state === "string"));
}

export async function getCollectionConflicts(params: Record<string, string>): Promise<ConflictPayload & { error?: string }> {
  const empty: ConflictPayload = {
    results: [], latest_scan: null,
    pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 },
  };
  const session = (await cookies()).get("teklease_staff_session")?.value;
  if (!session) return { ...empty, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  try {
    const query = new URLSearchParams({ ...params, page_size: "20" });
    const response = await fetch(getBackendUrl(`/api/v1/staff/collections/imei-conflicts?${query}`), {
      headers: { Cookie: `sessionid=${session}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    const data = await readBackendJson(response);
    if (!response.ok || !isPayload(data)) {
      return { ...empty, error: "No pudimos cargar los conflictos. Volvé a intentar; si persiste, contactá a soporte." };
    }
    return data;
  } catch {
    return { ...empty, error: "No pudimos conectar con el servicio. Intentá nuevamente en unos minutos." };
  }
}
