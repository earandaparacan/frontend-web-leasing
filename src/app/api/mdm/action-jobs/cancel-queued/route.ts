import { forwardMdmRequest, getMdmActionJobsUrl } from "@/lib/mdm-backend";

type CancelQueuedPayload = {
  action?: unknown;
};

export async function POST(request: Request) {
  let payload: CancelQueuedPayload;
  try {
    payload = (await request.json()) as CancelQueuedPayload;
  } catch {
    return Response.json(
      { status: "error", message: "La solicitud no contiene JSON válido." },
      { status: 400 },
    );
  }

  if (payload.action !== "lock" && payload.action !== "unlock") {
    return Response.json(
      { status: "error", message: "Seleccioná una acción válida." },
      { status: 400 },
    );
  }

  return forwardMdmRequest(
    `${getMdmActionJobsUrl()}/cancel-queued`,
    { action: payload.action },
    30_000,
    "POST",
  );
}
