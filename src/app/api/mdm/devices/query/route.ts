import { forwardMdmRequest, getMdmQueryUrl } from "@/lib/mdm-backend";

type QueryPayload = {
  devices?: unknown;
};

export async function POST(request: Request) {
  let payload: QueryPayload;

  try {
    payload = (await request.json()) as QueryPayload;
  } catch {
    return Response.json(
      { status: "error", message: "La solicitud no contiene JSON válido." },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(payload.devices) ||
    payload.devices.length === 0 ||
    !payload.devices.every(
      (device) => typeof device === "string" && device.trim().length > 0,
    )
  ) {
    return Response.json(
      {
        status: "error",
        message: "Enviá al menos un identificador válido.",
      },
      { status: 400 },
    );
  }

  const devices = [...new Set(payload.devices.map((device) => device.trim()))];
  return forwardMdmRequest(getMdmQueryUrl(), { devices });
}
