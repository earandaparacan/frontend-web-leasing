import { randomUUID } from "node:crypto";
import { forwardMdmRequest, getMdmMessageJobsUrl } from "@/lib/mdm-backend";

type CreateMessageJobPayload = {
  devices?: unknown;
  message?: unknown;
};

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function idempotencyKey(request: Request) {
  const suppliedKey = request.headers.get("idempotency-key")?.trim();
  return suppliedKey || randomUUID();
}

export async function POST(request: Request) {
  let payload: CreateMessageJobPayload;

  try {
    payload = (await request.json()) as CreateMessageJobPayload;
  } catch {
    return Response.json(
      { status: "error", message: "La solicitud no contiene JSON válido." },
      { status: 400 },
    );
  }

  if (
    typeof payload.message !== "string" ||
    payload.message.trim().length === 0
  ) {
    return Response.json(
      { status: "error", message: "El mensaje no puede estar vacío." },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(payload.devices) ||
    payload.devices.length === 0 ||
    !payload.devices.every(validIdentifier)
  ) {
    return Response.json(
      {
        status: "error",
        message: "Seleccioná al menos un dispositivo válido.",
      },
      { status: 400 },
    );
  }

  const devices = [...new Set(payload.devices.map((device) => device.trim()))];

  return forwardMdmRequest(
    getMdmMessageJobsUrl(),
    { devices, message: payload.message.trim() },
    30_000,
    "POST",
    { "Idempotency-Key": idempotencyKey(request) },
  );
}
