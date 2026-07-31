import { forwardMdmRequest, getMdmActionUrl } from "@/lib/mdm-backend";

type ActionPayload = {
  devices?: unknown;
  action?: unknown;
  message?: unknown;
};

function isDevice(value: unknown): value is { number: string; db_id: number } {
  if (typeof value !== "object" || value === null) return false;

  const device = value as Record<string, unknown>;
  return (
    typeof device.number === "string" &&
    device.number.trim().length > 0 &&
    device.number.length <= 128 &&
    typeof device.db_id === "number" &&
    Number.isSafeInteger(device.db_id) &&
    device.db_id > 0
  );
}

export async function POST(request: Request) {
  let payload: ActionPayload;

  try {
    payload = (await request.json()) as ActionPayload;
  } catch {
    return Response.json(
      { status: "error", message: "La solicitud no contiene JSON válido." },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(payload.devices) ||
    payload.devices.length === 0 ||
    payload.devices.length > 100 ||
    !payload.devices.every(isDevice)
  ) {
    return Response.json(
      { status: "error", message: "La selección contiene dispositivos inválidos." },
      { status: 400 },
    );
  }

  if (payload.action !== "lock" && payload.action !== "unlock") {
    return Response.json(
      { status: "error", message: "La acción solicitada no es válida." },
      { status: 400 },
    );
  }

  if (typeof payload.message !== "string" || payload.message.length > 500) {
    return Response.json(
      { status: "error", message: "El mensaje de bloqueo no es válido." },
      { status: 400 },
    );
  }

  return forwardMdmRequest(getMdmActionUrl(), {
    devices: payload.devices.map((device) => ({
      number: device.number.trim(),
      db_id: device.db_id,
    })),
    action: payload.action,
    message: payload.action === "lock" ? payload.message.trim() : "",
  });
}
