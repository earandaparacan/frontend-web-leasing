import { cookies } from "next/headers";
import { getBackendUrl } from "@/lib/backend";
import type { MonitorReportData } from "@/features/monitor-odoo/monitor-types";

const DEFAULT_MONITOR_DATA_PATH = "/api/v1/staff/odoo/monitor/data";
const DEFAULT_MONITOR_EXPORT_PATH = "/staff/odoo/monitor/export/excel/";

export function getOdooMonitorDataUrl(forceRefresh = false): string {
  const query = forceRefresh ? "?refresh=1" : "";
  return getBackendUrl(`${DEFAULT_MONITOR_DATA_PATH}${query}`);
}

export function getOdooMonitorExportExcelUrl(status = "all"): string {
  return getBackendUrl(`${DEFAULT_MONITOR_EXPORT_PATH}?status=${encodeURIComponent(status)}`);
}

export async function fetchOdooMonitorReport(forceRefresh = false): Promise<MonitorReportData> {
  const cookieStore = await cookies();
  const session = cookieStore.get("teklease_staff_session")?.value;
  const csrf = cookieStore.get("teklease_staff_csrf")?.value;

  const url = getOdooMonitorDataUrl(forceRefresh);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (session) {
    headers.Cookie = `sessionid=${session}${csrf ? `; csrftoken=${csrf}` : ""}`;
  }
  if (csrf) {
    headers["X-CSRFToken"] = csrf;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        total_orders: 0,
        total_imeis: 0,
        count_al_dia: 0,
        count_promesa: 0,
        count_promesa_protegida: 0,
        count_promesas_vigentes: 0,
        count_promesas_vencidas: 0,
        count_tolerancia: 0,
        count_bloqueados: 0,
        count_habilitados: 0,
        percent_bloqueados: 0,
        percent_habilitados: 0,
        top_branches: [],
        items: [],
        error: `Error ${response.status}: No se pudo cargar el reporte del monitor`,
      };
    }

    return (await response.json()) as MonitorReportData;
  } catch (error) {
    return {
      total_orders: 0,
      total_imeis: 0,
      count_al_dia: 0,
      count_promesa: 0,
      count_promesa_protegida: 0,
      count_promesas_vigentes: 0,
      count_promesas_vencidas: 0,
      count_tolerancia: 0,
      count_bloqueados: 0,
      count_habilitados: 0,
      percent_bloqueados: 0,
      percent_habilitados: 0,
      top_branches: [],
      items: [],
      error: error instanceof Error ? error.message : "Error al consultar el monitor de Odoo",
    };
  }
}
