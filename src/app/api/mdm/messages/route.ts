import { forwardMdmRequest, getMdmMessageUrl } from "@/lib/mdm-backend";

type MessagePayload = {
  device_number?: unknown;
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
    typeof payload.device_number !== "string" ||
    payload.device_number.trim().length === 0 ||
    payload.device_number.trim().length > 128
  ) {
    return Response.json(
      { status: "error", message: "Seleccioná un dispositivo válido." },
      { status: 400 },
    );
  }

  if (
    typeof payload.message !== "string" ||
    payload.message.trim().length === 0 ||
    payload.message.trim().length > 1000
  ) {
    return Response.json(
      { status: "error", message: "El mensaje debe contener entre 1 y 1000 caracteres." },
      { status: 400 },
    );
  }

  return forwardMdmRequest(getMdmMessageUrl(), {
    device_number: payload.device_number.trim(),
    message: payload.message.trim(),
  });
}
