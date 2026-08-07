import { cookies } from "next/headers";
import { getBackendUrl, readBackendJson } from "@/lib/backend";

type DashboardRecord = Record<string, unknown>;

export type DashboardSummary = {
  mdm_devices: number | null;
  mdm_without_configuration: number | null;
  mdm_locked: number | null;
  mdm_unlocked: number | null;
  mdm_lock_status_unknown?: number | null;
  mdm_without_report_24h?: number | null;
  mdm_without_report_7d?: number | null;
  mdm_in_progress: number;
  mdm_failures_24h: number;
  otp_attention_24h: number;
  payments_to_review_24h: number;
};

export type DashboardAlert = {
  severity: string;
  title: string;
  detail: string;
  href: string;
};

export type DashboardExecution = {
  id: string;
  type: string;
  title: string;
  detail: string;
  status: string;
  status_label: string;
  created_at: string;
  href: string;
};

export type DashboardActivity = {
  id: string;
  type: string;
  title: string;
  detail: string;
  created_at: string;
  href: string;
};

export type OperationalDashboard = {
  generated_at: string;
  summary: DashboardSummary;
  alerts: DashboardAlert[];
  executions: DashboardExecution[];
  activity: DashboardActivity[];
};

export type OperationalDashboardResult = {
  dashboard: OperationalDashboard | null;
  error?: string;
};

function isRecord(value: unknown): value is DashboardRecord {
  return typeof value === "object" && value !== null;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isSummary(value: unknown): value is DashboardSummary {
  if (!isRecord(value)) return false;
  return (
    isNullableNumber(value.mdm_devices) &&
    isNullableNumber(value.mdm_without_configuration) &&
    isNullableNumber(value.mdm_locked) &&
    isNullableNumber(value.mdm_unlocked) &&
    (value.mdm_lock_status_unknown === undefined || isNullableNumber(value.mdm_lock_status_unknown)) &&
    (value.mdm_without_report_24h === undefined || isNullableNumber(value.mdm_without_report_24h)) &&
    (value.mdm_without_report_7d === undefined || isNullableNumber(value.mdm_without_report_7d)) &&
    typeof value.mdm_in_progress === "number" &&
    Number.isFinite(value.mdm_in_progress) &&
    typeof value.mdm_failures_24h === "number" &&
    Number.isFinite(value.mdm_failures_24h) &&
    typeof value.otp_attention_24h === "number" &&
    Number.isFinite(value.otp_attention_24h) &&
    typeof value.payments_to_review_24h === "number" &&
    Number.isFinite(value.payments_to_review_24h)
  );
}

function isLinkItem(value: unknown): value is {
  id: string;
  type: string;
  title: string;
  detail: string;
  created_at: string;
  href: string;
} {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    typeof value.detail === "string" &&
    typeof value.created_at === "string" &&
    typeof value.href === "string" &&
    value.href.startsWith("/")
  );
}

function isAlert(value: unknown): value is DashboardAlert {
  if (!isRecord(value)) return false;
  return (
    typeof value.severity === "string" &&
    typeof value.title === "string" &&
    typeof value.detail === "string" &&
    typeof value.href === "string" &&
    value.href.startsWith("/")
  );
}

function isExecution(value: unknown): value is DashboardExecution {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    typeof value.detail === "string" &&
    typeof value.status === "string" &&
    typeof value.status_label === "string" &&
    typeof value.created_at === "string" &&
    typeof value.href === "string" &&
    value.href.startsWith("/")
  );
}

function isActivity(value: unknown): value is DashboardActivity {
  return isLinkItem(value);
}

function isDashboard(value: unknown): value is OperationalDashboard {
  if (!isRecord(value)) return false;
  return (
    typeof value.generated_at === "string" &&
    isSummary(value.summary) &&
    Array.isArray(value.alerts) &&
    value.alerts.every(isAlert) &&
    Array.isArray(value.executions) &&
    value.executions.every(isExecution) &&
    Array.isArray(value.activity) &&
    value.activity.every(isActivity)
  );
}

function errorMessage(data: unknown): string {
  if (isRecord(data) && typeof data.message === "string") return data.message;
  return "No se pudo cargar el resumen operativo.";
}

export async function getOperationalDashboard(): Promise<OperationalDashboardResult> {
  const cookieStore = await cookies();
  const session = cookieStore.get("teklease_staff_session")?.value;
  if (!session) {
    return { dashboard: null, error: "Tu sesión expiró." };
  }

  try {
    const response = await fetch(getBackendUrl("/api/v1/staff/dashboard"), {
      headers: { Cookie: `sessionid=${session}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await readBackendJson(response);

    if (!response.ok || !isDashboard(data)) {
      return { dashboard: null, error: errorMessage(data) };
    }
    return { dashboard: data };
  } catch {
    return {
      dashboard: null,
      error: "No pudimos conectar con el backend. Verificá que el servicio esté activo.",
    };
  }
}
