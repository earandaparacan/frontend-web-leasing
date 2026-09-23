import { cookies } from "next/headers";
import { getBackendUrl } from "@/lib/backend";

export async function GET() {
  const session = (await cookies()).get("teklease_staff_session")?.value;
  if (!session) {
    return Response.json(
      { status: "error", message: "Tu sesión expiró. Iniciá sesión nuevamente." },
      { status: 401 },
    );
  }

  try {
    const backendResponse = await fetch(
      getBackendUrl("/api/v1/staff/collections/cases/export"),
      {
        headers: { Cookie: `sessionid=${session}` },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!backendResponse.ok) {
      return Response.json(
        { status: "error", message: "No pudimos exportar el panorama de cobranzas. Intentá nuevamente." },
        { status: backendResponse.status },
      );
    }

    return new Response(await backendResponse.arrayBuffer(), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": backendResponse.headers.get("content-disposition") ??
          'attachment; filename="panorama-cobranzas.xls"',
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
