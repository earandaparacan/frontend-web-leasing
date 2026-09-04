import { forwardMdmRequest } from "@/lib/mdm-backend";
import { getOdooMonitorExportExcelUrl } from "@/lib/odoo-monitor-backend";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";

  return forwardMdmRequest(
    getOdooMonitorExportExcelUrl(status),
    undefined,
    30_000,
    "GET",
  );
}
