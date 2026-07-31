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
  status: MessageJobStatus;
  total: number;
  pending: number;
  accepted: number;
  failed: number;
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
    status: candidate.status,
    total: candidate.total,
    pending: candidate.pending,
    accepted: candidate.accepted,
    failed: candidate.failed,
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
