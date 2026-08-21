export type MdmDeviceActionJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "CANCELLED"
  | "SUCCEEDED"
  | "PARTIAL_SUCCESS"
  | "FAILED";

export type MdmDeviceActionJob = {
  id: string;
  branchId: number | null;
  branchName: string;
  createdAt: string;
  rerunOf: string | null;
  action: "lock" | "unlock";
  status: MdmDeviceActionJobStatus;
  total: number;
  pending: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  lastError: string;
};

export type MdmDeviceActionJobDetail = MdmDeviceActionJob & {
  message: string;
  items: Array<{
    deviceId: string;
    status: string;
    attempts: number;
    lastError: string;
  }>;
};

const statuses = new Set<MdmDeviceActionJobStatus>([
  "QUEUED",
  "RUNNING",
  "CANCELLED",
  "SUCCEEDED",
  "PARTIAL_SUCCESS",
  "FAILED",
]);

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isBranchId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseMdmDeviceActionJob(value: unknown): MdmDeviceActionJob | null {
  if (typeof value !== "object" || value === null) return null;
  const job = value as Record<string, unknown>;
  const branchId = job.branch_id;
  if (
    typeof job.id !== "string" ||
    typeof job.branch_name !== "string" ||
    (branchId !== undefined && branchId !== null && !isBranchId(branchId)) ||
    typeof job.created_at !== "string" ||
    Number.isNaN(Date.parse(job.created_at)) ||
    (job.rerun_of !== null && typeof job.rerun_of !== "string") ||
    (job.action !== "lock" && job.action !== "unlock") ||
    typeof job.status !== "string" ||
    !statuses.has(job.status as MdmDeviceActionJobStatus) ||
    !isNonNegativeInteger(job.total) ||
    !isNonNegativeInteger(job.pending) ||
    !isNonNegativeInteger(job.succeeded) ||
    !isNonNegativeInteger(job.failed) ||
    !isNonNegativeInteger(job.cancelled) ||
    (job.last_error !== undefined && typeof job.last_error !== "string")
  ) {
    return null;
  }

  return {
    id: job.id,
    branchId: isBranchId(branchId) ? branchId : null,
    branchName: job.branch_name,
    createdAt: job.created_at,
    rerunOf: typeof job.rerun_of === "string" ? job.rerun_of : null,
    action: job.action,
    status: job.status as MdmDeviceActionJobStatus,
    total: job.total,
    pending: job.pending,
    succeeded: job.succeeded,
    failed: job.failed,
    cancelled: job.cancelled,
    lastError: typeof job.last_error === "string" ? job.last_error : "",
  };
}

export function parseMdmDeviceActionJobDetail(
  value: unknown,
): MdmDeviceActionJobDetail | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = "job" in value ? value.job : value;
  if (typeof candidate !== "object" || candidate === null) return null;
  const job = parseMdmDeviceActionJob(candidate);
  const detail = candidate as Record<string, unknown>;
  if (!job || typeof detail.message !== "string" || !Array.isArray(detail.items)) {
    return null;
  }

  const items = detail.items.map((item) => {
    if (typeof item !== "object" || item === null) return null;
    const itemValue = item as Record<string, unknown>;
    if (
      typeof itemValue.device_id !== "string" ||
      typeof itemValue.status !== "string" ||
      !isNonNegativeInteger(itemValue.attempts) ||
      typeof itemValue.last_error !== "string"
    ) {
      return null;
    }
    return {
      deviceId: itemValue.device_id,
      status: itemValue.status,
      attempts: itemValue.attempts,
      lastError: itemValue.last_error,
    };
  });
  if (items.some((item) => item === null)) return null;

  return {
    ...job,
    message: detail.message,
    items: items.filter(
      (item): item is MdmDeviceActionJobDetail["items"][number] => item !== null,
    ),
  };
}

export function isTerminalMdmDeviceActionJob(job: MdmDeviceActionJob) {
  return ["SUCCEEDED", "PARTIAL_SUCCESS", "FAILED", "CANCELLED"].includes(job.status);
}

export function mdmDeviceActionJobLabel(job: MdmDeviceActionJob) {
  if (job.status === "QUEUED") return "En cola";
  if (job.status === "RUNNING") {
    return job.action === "lock" ? "Bloqueando dispositivos" : "Desbloqueando dispositivos";
  }
  if (job.status === "CANCELLED") return "Cancelado";
  if (job.status === "SUCCEEDED") return "Completado";
  if (job.status === "PARTIAL_SUCCESS") return "Completado con errores";
  return "Fallido";
}

export function mdmDeviceActionJobItemLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    PROCESSING: "Procesando",
    SUCCEEDED: "Completado",
    NOT_FOUND: "No encontrado",
    FAILED: "Fallido",
    CANCELLED: "Cancelado",
  };

  return labels[status] ?? status;
}
