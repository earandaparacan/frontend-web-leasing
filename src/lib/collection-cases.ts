import "server-only";
import { cookies } from "next/headers";
import { getBackendUrl, readBackendJson } from "@/lib/backend";
import type { Pagination } from "@/lib/staff-data";

export type CollectionCase = {
  id: number;
  odoo_order_id: number;
  odoo_partner_id: number;
  imei: string;
  sucursal: string;
  operador: string;
  numero_operador: string;
  phase: number;
  phase_label: string;
  overdue_count: number;
  has_recent_payment: boolean;
  payment_promise_date: string | null;
  promise_is_valid: boolean;
  is_lock_requested: boolean;
  last_evaluated_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CollectionCaseDetail = CollectionCase & {
  events: CollectionEvent[];
};

export type CollectionCasesSummary = {
  total: number;
  active: number;
  critical: number;
  lock_requested: number;
  valid_promises: number;
  phases: Record<"0" | "1" | "2" | "3" | "4", number>;
};

export type CollectionEvent = {
  id: number;
  event_key: string;
  event_type: string;
  event_type_label: string;
  source: "POLICY" | "MANUAL";
  source_label: string;
  execution: {
    id: number;
    operation: string;
    operation_label: string;
    status: string;
    started_at: string;
  } | null;
  created_by: {
    id: string;
    username: string;
    display_name: string;
    source: "job" | "policy";
  } | null;
  message: string;
  message_job_id: string | null;
  action_job_id: string | null;
  job: {
    status: string;
    status_label: string;
    item_status: string | null;
    item_status_label: string | null;
  } | null;
  created_at: string;
};

type CollectionCasesPayload = {
  results: CollectionCase[];
  pagination: Pagination;
  summary: CollectionCasesSummary;
};

const emptyPayload: CollectionCasesPayload = {
  results: [],
  pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 },
  summary: {
    total: 0,
    active: 0,
    critical: 0,
    lock_requested: 0,
    valid_promises: 0,
    phases: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0 },
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isEventCreator(value: unknown) {
  return value === null || (
    isObject(value) &&
    ["id", "username", "display_name"].every(
      (field) => typeof value[field] === "string",
    ) &&
    (value.source === "job" || value.source === "policy")
  );
}

function isCollectionCase(value: unknown): value is CollectionCase {
  if (!isObject(value)) return false;
  const numericFields = [
    "id",
    "odoo_order_id",
    "odoo_partner_id",
    "phase",
    "overdue_count",
  ];
  const stringFields = [
    "imei",
    "sucursal",
    "operador",
    "numero_operador",
    "phase_label",
    "last_evaluated_at",
    "created_at",
    "updated_at",
  ];
  const booleanFields = [
    "has_recent_payment",
    "promise_is_valid",
    "is_lock_requested",
  ];
  return (
    numericFields.every((field) => typeof value[field] === "number") &&
    stringFields.every((field) => typeof value[field] === "string") &&
    booleanFields.every((field) => typeof value[field] === "boolean") &&
    isNullableString(value.payment_promise_date) &&
    isNullableString(value.resolved_at)
  );
}

function isCollectionEvent(value: unknown): value is CollectionEvent {
  if (!isObject(value)) return false;
  const execution = value.execution;
  const validExecution = execution === null || (
    isObject(execution) &&
    typeof execution.id === "number" &&
    ["operation", "operation_label", "status", "started_at"].every(
      (field) => typeof execution[field] === "string",
    )
  );
  const job = value.job;
  const validJob = job === null || (
    isObject(job) &&
    typeof job.status === "string" &&
    typeof job.status_label === "string" &&
    isNullableString(job.item_status) &&
    isNullableString(job.item_status_label)
  );
  return (
    typeof value.id === "number" &&
    ["event_key", "event_type", "event_type_label", "source_label", "message", "created_at"].every(
      (field) => typeof value[field] === "string",
    ) &&
    (value.source === "POLICY" || value.source === "MANUAL") &&
    isNullableString(value.message_job_id) &&
    isNullableString(value.action_job_id) &&
    isEventCreator(value.created_by) &&
    validJob &&
    validExecution
  );
}

function isPayload(value: unknown): value is CollectionCasesPayload {
  if (!isObject(value) || !Array.isArray(value.results)) return false;
  const pagination = value.pagination;
  const summary = value.summary;
  const phases = isObject(summary) ? summary.phases : null;
  return (
    value.results.every(isCollectionCase) &&
    isObject(pagination) &&
    ["page", "page_size", "total", "total_pages"].every(
      (field) => typeof pagination[field] === "number",
    ) &&
    isObject(summary) &&
    ["total", "active", "critical", "lock_requested", "valid_promises"].every(
      (field) => typeof summary[field] === "number",
    ) &&
    isObject(phases) &&
    ["0", "1", "2", "3", "4"].every(
      (phase) => typeof phases[phase] === "number",
    )
  );
}

function isDetailPayload(value: unknown): value is { case: CollectionCaseDetail } {
  if (!isObject(value) || !isObject(value.case)) return false;
  const caseValue = value.case;
  if (!Array.isArray(caseValue.events) || !caseValue.events.every(isCollectionEvent)) {
    return false;
  }
  return isCollectionCase(caseValue);
}

function backendMessage(value: unknown) {
  return isObject(value) && typeof value.message === "string"
    ? value.message
    : "No pudimos cargar los estados de cobranzas.";
}

export async function getCollectionCases(
  params: Record<string, string>,
): Promise<CollectionCasesPayload & { error?: string }> {
  const session = (await cookies()).get("teklease_staff_session")?.value;
  if (!session) {
    return { ...emptyPayload, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const query = new URLSearchParams({ ...params, page_size: "20" });
  try {
    const response = await fetch(
      getBackendUrl(`/api/v1/staff/collections/cases?${query}`),
      {
        headers: { Cookie: `sessionid=${session}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await readBackendJson(response);
    if (!response.ok || !isPayload(data)) {
      return { ...emptyPayload, error: backendMessage(data) };
    }
    return data;
  } catch {
    return {
      ...emptyPayload,
      error: "No pudimos conectar con el backend. Intentá nuevamente.",
    };
  }
}

export async function getCollectionCase(caseId: number): Promise<{
  case: CollectionCaseDetail | null;
  error?: string;
  notFound?: boolean;
}> {
  const session = (await cookies()).get("teklease_staff_session")?.value;
  if (!session) {
    return { case: null, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  try {
    const response = await fetch(
      getBackendUrl(`/api/v1/staff/collections/cases/${caseId}`),
      {
        headers: { Cookie: `sessionid=${session}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await readBackendJson(response);
    if (response.status === 404) return { case: null, notFound: true };
    if (!response.ok || !isDetailPayload(data)) {
      return { case: null, error: backendMessage(data) };
    }
    return { case: data.case };
  } catch {
    return {
      case: null,
      error: "No pudimos conectar con el backend. Intentá nuevamente.",
    };
  }
}
