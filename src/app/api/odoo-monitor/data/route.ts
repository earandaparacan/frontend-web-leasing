import { forwardMdmRequest } from "@/lib/mdm-backend";
import { getOdooMonitorDataUrl } from "@/lib/odoo-monitor-backend";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  return forwardMdmRequest(
    getOdooMonitorDataUrl(forceRefresh),
    undefined,
    30_000,
    "GET",
  );
}
