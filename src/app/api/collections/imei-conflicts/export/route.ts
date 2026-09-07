import { cookies } from "next/headers";
import { getBackendUrl } from "@/lib/backend";

const ALLOWED_PARAMS = ["search", "kind", "history"] as const;

export async function GET(request: Request) {
  const session = (await cookies()).get("teklease_staff_session")?.value;
  if (!session) {
    return Response.json(
      { status: "error", message: "Tu sesión expiró. Iniciá sesión nuevamente." },
      { status: 401 },
    );
  }

  const sourceParams = new URL(request.url).searchParams;
  const exportParams = new URLSearchParams();
  for (const name of ALLOWED_PARAMS) {
    const value = sourceParams.get(name);
    if (value) exportParams.set(name, value);
  }

  try {
    const query = exportParams.toString();
    const backendResponse = await fetch(
      getBackendUrl(`/api/v1/staff/collections/imei-conflicts/export${query ? `?${query}` : ""}`),
      {
        headers: { Cookie: `sessionid=${session}` },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!backendResponse.ok) {
      return Response.json(
        { status: "error", message: "No pudimos exportar los conflictos. Intentá nuevamente." },
        { status: backendResponse.status },
      );
    }

    return new Response(await backendResponse.arrayBuffer(), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": backendResponse.headers.get("content-disposition") ??
          'attachment; filename="imei-duplicados.xls"',
        "Content-Type": backendResponse.headers.get("content-type") ??
          "application/vnd.ms-excel; charset=utf-8",
      },
    });
  } catch {
    return Response.json(
      { status: "error", message: "No pudimos conectar con el servicio. Intentá nuevamente." },
      { status: 503 },
    );
  }
}
