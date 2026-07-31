import { forwardMdmRequest, getMdmMessageUrl } from "@/lib/mdm-backend";

type MessagePayload = {
  scope?: unknown;
  group_id?: unknown;
  devices?: unknown;
  message?: unknown;
};

export async function POST(request: Request) {
  let payload: MessagePayload;

  try {
    payload = (await request.json()) as MessagePayload;
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

  if (payload.scope === "all") {
    return forwardMdmRequest(
      getMdmMessageUrl(),
      {
        scope: "all",
        message: payload.message.trim(),
      },
      55_000,
    );
  }

  if (payload.scope === "group") {
    if (
      typeof payload.group_id !== "number" ||
      !Number.isSafeInteger(payload.group_id) ||
      payload.group_id <= 0
    ) {
      return Response.json(
        { status: "error", message: "Seleccioná un grupo válido." },
        { status: 400 },
      );
    }
    return forwardMdmRequest(
      getMdmMessageUrl(),
      {
        scope: "group",
        group_id: payload.group_id,
        message: payload.message.trim(),
      },
      55_000,
    );
  }

  if (
    payload.scope !== "devices" ||
    !Array.isArray(payload.devices) ||
    payload.devices.length === 0 ||
    !payload.devices.every(
      (device) =>
        typeof device === "string" &&
        device.trim().length > 0,
    )
  ) {
    return Response.json(
      { status: "error", message: "Seleccioná al menos un dispositivo válido." },
      { status: 400 },
    );
  }

  const devices = [...new Set(payload.devices.map((device) => device.trim()))];
  return forwardMdmRequest(getMdmMessageUrl(), {
    scope: "devices",
    devices,
    message: payload.message.trim(),
  });
}
