export type MdmDeviceActionJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "PARTIAL_SUCCESS"
  | "FAILED";

export type MdmDeviceActionJob = {
  id: string;
  action: "lock" | "unlock";
  status: MdmDeviceActionJobStatus;
  total: number;
  pending: number;
  succeeded: number;
  failed: number;
  lastError: string;
};

const statuses = new Set<MdmDeviceActionJobStatus>([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "PARTIAL_SUCCESS",
  "FAILED",
]);

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseMdmDeviceActionJob(value: unknown): MdmDeviceActionJob | null {
  if (typeof value !== "object" || value === null) return null;
  const job = value as Record<string, unknown>;
  if (
    typeof job.id !== "string" ||
    (job.action !== "lock" && job.action !== "unlock") ||
    typeof job.status !== "string" ||
    !statuses.has(job.status as MdmDeviceActionJobStatus) ||
    !isNonNegativeInteger(job.total) ||
    !isNonNegativeInteger(job.pending) ||
    !isNonNegativeInteger(job.succeeded) ||
    !isNonNegativeInteger(job.failed) ||
    (job.last_error !== undefined && typeof job.last_error !== "string")
  ) {
    return null;
  }

  return {
    id: job.id,
    action: job.action,
    status: job.status as MdmDeviceActionJobStatus,
    total: job.total,
    pending: job.pending,
    succeeded: job.succeeded,
    failed: job.failed,
    lastError: typeof job.last_error === "string" ? job.last_error : "",
  };
}

export function isTerminalMdmDeviceActionJob(job: MdmDeviceActionJob) {
  return ["SUCCEEDED", "PARTIAL_SUCCESS", "FAILED"].includes(job.status);
}

export function mdmDeviceActionJobLabel(job: MdmDeviceActionJob) {
  if (job.status === "QUEUED") return "En cola";
  if (job.status === "RUNNING") {
    return job.action === "lock" ? "Bloqueando dispositivos" : "Desbloqueando dispositivos";
  }
  if (job.status === "SUCCEEDED") return "Completado";
  if (job.status === "PARTIAL_SUCCESS") return "Completado con errores";
  return "Fallido";
}
