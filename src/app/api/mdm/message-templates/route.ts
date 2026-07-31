import {
  forwardMdmRequest,
  getMdmMessageTemplatesUrl,
} from "@/lib/mdm-backend";

type MessageTemplatePayload = {
  message?: unknown;
};

export async function GET() {
  return forwardMdmRequest(
    getMdmMessageTemplatesUrl(),
    undefined,
    30_000,
    "GET",
  );
}

export async function POST(request: Request) {
  let payload: MessageTemplatePayload;

  try {
    payload = (await request.json()) as MessageTemplatePayload;
  } catch {
    return Response.json(
      { status: "error", message: "La solicitud no contiene JSON válido." },
      { status: 400 },
    );
  }

  if (
    typeof payload.message !== "string" ||
    payload.message.trim().length === 0 ||
    payload.message.trim().length > 1000
  ) {
    return Response.json(
      { status: "error", message: "La plantilla debe contener entre 1 y 1000 caracteres." },
      { status: 400 },
    );
  }

  return forwardMdmRequest(getMdmMessageTemplatesUrl(), {
    message: payload.message.trim(),
  });
}
