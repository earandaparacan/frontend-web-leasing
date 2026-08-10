import { NextRequest } from "next/server";
import { getBackendUrl, readBackendJson } from "@/lib/backend";
import { getMdmActionJobsUrl } from "@/lib/mdm-backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;
  const session = request.cookies.get("teklease_staff_session")?.value;
  const csrf = request.cookies.get("teklease_staff_csrf")?.value;

  if (!session) {
    return Response.json(
      { status: "error", message: "Tu sesión expiró. Iniciá sesión nuevamente." },
      { status: 401 },
    );
  }

  try {
    const backendResponse = await fetch(getMdmActionJobsUrl(jobId, "events"), {
      headers: {
        Cookie: `sessionid=${session}${csrf ? `; csrftoken=${csrf}` : ""}`,
      },
      cache: "no-store",
      signal: request.signal,
    });

    if (!backendResponse.ok || !backendResponse.body) {
      return Response.json(await readBackendJson(backendResponse), {
        status: backendResponse.status,
      });
    }

    return new Response(backendResponse.body, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json(
      { status: "error", message: "No pudimos conectar con el servicio MDM." },
      { status: 503 },
    );
  }
}
