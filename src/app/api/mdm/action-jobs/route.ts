import { randomUUID } from "node:crypto";
import { forwardMdmRequest, getMdmActionJobsUrl } from "@/lib/mdm-backend";

type CreateActionJobPayload = {
  scope?: unknown;
  devices?: unknown;
  action?: unknown;
  message?: unknown;
  branch_id?: unknown;
};

function isDevice(value: unknown): value is { number: string } {
  if (typeof value !== "object" || value === null) return false;
  const device = value as Record<string, unknown>;
  return typeof device.number === "string" && device.number.trim().length > 0;
}

export async function POST(request: Request) {
  let payload: CreateActionJobPayload;
  try {
    payload = (await request.json()) as CreateActionJobPayload;
  } catch {
    return Response.json(
      { status: "error", message: "La solicitud no contiene JSON válido." },
      { status: 400 },
    );
  }

  if (payload.action !== "lock" && payload.action !== "unlock") {
    return Response.json(
      { status: "error", message: "La acción solicitada no es válida." },
      { status: 400 },
    );
  }
  if (payload.scope !== "devices") {
    return Response.json(
      { status: "error", message: "Por el momento solo se permiten dispositivos específicos." },
      { status: 400 },
    );
  }
  if (
    !Array.isArray(payload.devices) || payload.devices.length === 0 ||
    payload.devices.length > 1000 || !payload.devices.every(isDevice)
  ) {
    return Response.json(
      { status: "error", message: "Seleccioná entre 1 y 1000 dispositivos válidos." },
      { status: 400 },
    );
  }
  if (payload.message !== undefined && typeof payload.message !== "string") {
    return Response.json(
      { status: "error", message: "El mensaje de bloqueo no es válido." },
      { status: 400 },
    );
  }
  if (payload.action === "lock" && !payload.message?.trim()) {
    return Response.json(
      { status: "error", message: "Seleccioná una plantilla antes de bloquear dispositivos." },
      { status: 400 },
    );
  }
  if (
    payload.branch_id !== undefined &&
    (typeof payload.branch_id !== "number" ||
      !Number.isSafeInteger(payload.branch_id) ||
      payload.branch_id <= 0)
  ) {
    return Response.json(
      { status: "error", message: "La sucursal seleccionada no es válida." },
      { status: 400 },
    );
  }

  const devices = Array.isArray(payload.devices) ? [
    ...new Map(
      payload.devices.map((device) => [
        device.number.trim(),
        { number: device.number.trim() },
      ]),
    ).values(),
  ] : [];
  const suppliedKey = request.headers.get("idempotency-key")?.trim();

  const branch = payload.branch_id === undefined ? {} : { branch_id: payload.branch_id };

  return forwardMdmRequest(
    getMdmActionJobsUrl(),
    {
      scope: payload.scope,
      devices,
      action: payload.action,
      message: payload.action === "lock" ? payload.message?.trim() ?? "" : "",
      ...branch,
    },
    30_000,
    "POST",
    { "Idempotency-Key": suppliedKey || randomUUID() },
  );
}

export async function GET(request: Request) {
  const exportAll = new URL(request.url).searchParams.get("export") === "all";
  const backendUrl = `${getMdmActionJobsUrl()}${exportAll ? "?export=all" : ""}`;

  return forwardMdmRequest(backendUrl, undefined, 30_000, "GET");
}
