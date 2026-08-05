export const messageJobStatuses = [
  "VALIDATING",
  "READY",
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "PARTIAL_SUCCESS",
  "FAILED",
] as const;

export type MessageJobStatus = (typeof messageJobStatuses)[number];

export type MessageJob = {
  id: string;
  branchName: string;
  createdAt: string;
  rerunOf: string | null;
  status: MessageJobStatus;
  total: number;
  pending: number;
  accepted: number;
  failed: number;
};

export type MessageJobDetail = MessageJob & {
  message: string;
  items: Array<{
    deviceId: string;
    status: string;
    attempts: number;
    lastError: string;
  }>;
};

const terminalStatuses = new Set<MessageJobStatus>([
  "SUCCEEDED",
  "PARTIAL_SUCCESS",
  "FAILED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isMessageJobStatus(value: unknown): value is MessageJobStatus {
  return typeof value === "string" && messageJobStatuses.some((status) => status === value);
}

export function parseMessageJob(value: unknown): MessageJob | null {
  if (!isRecord(value)) return null;

  const candidate = isRecord(value.job) ? value.job : value;
  if (
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    typeof candidate.branch_name !== "string" ||
    typeof candidate.created_at !== "string" ||
    Number.isNaN(Date.parse(candidate.created_at)) ||
    (candidate.rerun_of !== null && typeof candidate.rerun_of !== "string") ||
    !isMessageJobStatus(candidate.status) ||
    !isCount(candidate.total) ||
    !isCount(candidate.pending) ||
    !isCount(candidate.accepted) ||
    !isCount(candidate.failed)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    branchName: candidate.branch_name,
    createdAt: candidate.created_at,
    rerunOf: typeof candidate.rerun_of === "string" ? candidate.rerun_of : null,
    status: candidate.status,
    total: candidate.total,
    pending: candidate.pending,
    accepted: candidate.accepted,
    failed: candidate.failed,
  };
}

export function parseMessageJobDetail(value: unknown): MessageJobDetail | null {
  if (!isRecord(value)) return null;
  const candidate = isRecord(value.job) ? value.job : value;
  const job = parseMessageJob(candidate);
  if (!job || typeof candidate.message !== "string" || !Array.isArray(candidate.items)) {
    return null;
  }

  const items = candidate.items.map((item) => {
    if (!isRecord(item)) return null;
    if (
      typeof item.device_id !== "string" ||
      typeof item.status !== "string" ||
      !isCount(item.attempts) ||
      typeof item.last_error !== "string"
    ) {
      return null;
    }
    return {
      deviceId: item.device_id,
      status: item.status,
      attempts: item.attempts,
      lastError: item.last_error,
    };
  });
  if (items.some((item) => item === null)) return null;

  return {
    ...job,
    message: candidate.message,
    items: items.filter(
      (item): item is MessageJobDetail["items"][number] => item !== null,
    ),
  };
}

export function isTerminalMessageJob(job: MessageJob) {
  return terminalStatuses.has(job.status);
}

export function messageJobStatusLabel(status: MessageJobStatus) {
  const labels: Record<MessageJobStatus, string> = {
    VALIDATING: "Validando dispositivos",
    READY: "Listo para procesar",
    QUEUED: "En cola",
    RUNNING: "Enviando",
    SUCCEEDED: "Completado",
    PARTIAL_SUCCESS: "Completado con errores",
    FAILED: "Fallido",
  };

  return labels[status];
}

export function messageJobItemStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    PROCESSING: "Procesando",
    ACCEPTED: "Aceptado",
    NOT_FOUND: "No encontrado",
    FAILED: "Fallido",
  };

  return labels[status] ?? status;
}
