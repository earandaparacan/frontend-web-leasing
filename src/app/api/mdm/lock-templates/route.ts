import {
  forwardMdmRequest,
  getMdmLockTemplatesUrl,
} from "@/lib/mdm-backend";

type LockTemplatePayload = {
  message?: unknown;
};

export async function GET() {
  return forwardMdmRequest(
    getMdmLockTemplatesUrl(),
    undefined,
    30_000,
    "GET",
  );
}

export async function POST(request: Request) {
  let payload: LockTemplatePayload;

  try {
    payload = (await request.json()) as LockTemplatePayload;
  } catch {
    return Response.json(
      { status: "error", message: "La solicitud no contiene JSON válido." },
      { status: 400 },
    );
  }

  if (
    typeof payload.message !== "string" ||
    payload.message.trim().length === 0 ||
    payload.message.trim().length > 500
  ) {
    return Response.json(
      { status: "error", message: "La plantilla debe contener entre 1 y 500 caracteres." },
      { status: 400 },
    );
  }

  return forwardMdmRequest(getMdmLockTemplatesUrl(), {
    message: payload.message.trim(),
  });
}
