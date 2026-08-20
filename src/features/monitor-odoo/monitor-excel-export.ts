import type { MonitorReportData, MonitorSubscriptionItem } from "./monitor-types";

function escapeXml(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlCell(value: string | number | boolean | null | undefined, type: "String" | "Number" = "String", styleId?: string): string {
  const styleAttr = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Cell${styleAttr}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function xmlRow(cells: Array<{ value: string | number | boolean | null | undefined; type?: "String" | "Number"; styleId?: string }>): string {
  const cellsXml = cells
    .map((c) => xmlCell(c.value, c.type || "String", c.styleId))
    .join("");
  return `<Row>${cellsXml}</Row>`;
}

export function exportMonitorToExcel(data: MonitorReportData, itemsToExport: MonitorSubscriptionItem[], filterName = "Todos") {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(now);

  const filenameDate = now.toISOString().slice(0, 10);

  // 1. HOJA DE RESUMEN EJECUTIVO
  const summaryRows = [
    xmlRow([{ value: "TEKLEASE CLOUD - MONITOR DE ELEGIBILIDAD & BLOQUEOS MDM", styleId: "Title" }]),
    xmlRow([{ value: `Fecha de emisión: ${dateStr} (Hora local PY)` }]),
    xmlRow([{ value: `Base de Datos Odoo: ${data.odoo_db || "mergal-master-24463314"}` }]),
    xmlRow([{ value: `Filtro de exportación: ${filterName}` }]),
    xmlRow([{ value: "" }]),
    xmlRow([{ value: "MÉTRICAS CONSOLIDADAS DE CARTERA", styleId: "SectionHeader" }]),
    xmlRow([{ value: "Total Cartera Leasing (Órdenes):" }, { value: data.total_orders, type: "Number", styleId: "NumberBold" }]),
    xmlRow([{ value: "Total Dispositivos con IMEI:" }, { value: data.total_imeis, type: "Number", styleId: "NumberBold" }]),
    xmlRow([{ value: "Clientes Al Día (0-2 Facturas):" }, { value: data.count_al_dia, type: "Number" }]),
    xmlRow([{ value: "Clientes con Promesa Vigente:" }, { value: data.count_promesas_vigentes, type: "Number" }]),
    xmlRow([{ value: "Clientes con Promesa Vencida:" }, { value: data.count_promesas_vencidas, type: "Number" }]),
    xmlRow([{ value: "Total Promesas Registradas:" }, { value: data.count_promesa, type: "Number" }]),
    xmlRow([{ value: "Tolerancia de Pago Reciente (<= 15 días):" }, { value: data.count_tolerancia, type: "Number" }]),
    xmlRow([{ value: "Bloqueos Proyectados por Morosidad (>= 3 Facturas):" }, { value: data.count_bloqueados, type: "Number", styleId: "NumberDanger" }]),
    xmlRow([{ value: "Porcentaje de Cartera a Bloquear:" }, { value: `${data.percent_bloqueados}%` }]),
    xmlRow([{ value: "Total Clientes Habilitados Operativos:" }, { value: data.count_habilitados, type: "Number", styleId: "NumberSuccess" }]),
    xmlRow([{ value: "Porcentaje de Cartera Habilitada:" }, { value: `${data.percent_habilitados}%` }]),
    xmlRow([{ value: "" }]),
    xmlRow([{ value: "TOP SUCURSALES CON BLOQUEOS PROYECTADOS", styleId: "SectionHeader" }]),
    xmlRow([{ value: "Sucursal", styleId: "Header" }, { value: "Bloqueos", styleId: "Header" }, { value: "Porcentaje", styleId: "Header" }]),
    ...(data.top_branches || []).map((b) =>
      xmlRow([
        { value: b.branch_name },
        { value: b.count, type: "Number" },
        { value: `${b.percent}%` },
      ])
    ),
  ].join("\n    ");

  // 2. HOJA DE DETALLE DE CONTRATOS E IMEIS
  const detailHeaders = xmlRow([
    { value: "NRO_ORDEN", styleId: "Header" },
    { value: "CLIENTE", styleId: "Header" },
    { value: "IMEI", styleId: "Header" },
    { value: "MODELO_EQUIPO", styleId: "Header" },
    { value: "SUCURSAL", styleId: "Header" },
    { value: "OPERADOR_CALL_CENTER", styleId: "Header" },
    { value: "FACTURAS_VENCIDAS", styleId: "Header" },
    { value: "FECHA_PROMESA_PAGO", styleId: "Header" },
    { value: "ESTADO_PROMESA", styleId: "Header" },
    { value: "PAGO_RECIENTE_15D", styleId: "Header" },
    { value: "ESTADO_MDM", styleId: "Header" },
    { value: "ACCION_CRON_MDM", styleId: "Header" },
  ]);

  const detailRows = itemsToExport
    .map((item) => {
      let estadoPromesa = "SIN PROMESA";
      if (item.has_promise) {
        estadoPromesa = item.promesa_vencida ? "VENCIDA" : "VIGENTE";
      }

      let accionMdm = "HABILITAR";
      if (item.status_type === "bloqueado") {
        accionMdm = "BLOQUEAR";
      }

      return xmlRow([
        { value: item.order_name },
        { value: item.partner_name },
        { value: item.imei ? item.imei : "SIN IMEI" },
        { value: item.device_product || "Sin modelo" },
        { value: item.sucursal || "Sin sucursal" },
        { value: item.operador || "Sin operador" },
        { value: item.overdue_count, type: "Number" },
        { value: item.fecha_promesa_pago || "" },
        { value: estadoPromesa },
        { value: item.has_recent_payment ? "SI" : "NO" },
        { value: item.status_label },
        { value: accionMdm, styleId: accionMdm === "BLOQUEAR" ? "StatusDanger" : "StatusSuccess" },
      ]);
    })
    .join("\n    ");

  // XML SPREADSHEET ESTRUCTURADO COMPATIBLE 100% CON MICROSOFT EXCEL
  const spreadsheetXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Borders/>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#151515"/>
      <Interior/>
      <NumberFormat/>
      <Protection/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#EF5C2D"/>
    </Style>
    <Style ss:ID="SectionHeader">
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#151515"/>
      <Interior ss:Color="#FFF0EB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#171717" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="NumberBold">
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1"/>
      <Alignment ss:Horizontal="Right"/>
    </Style>
    <Style ss:ID="NumberDanger">
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#BE123C"/>
      <Alignment ss:Horizontal="Right"/>
    </Style>
    <Style ss:ID="NumberSuccess">
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#15803D"/>
      <Alignment ss:Horizontal="Right"/>
    </Style>
    <Style ss:ID="StatusDanger">
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#BE123C"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
    <Style ss:ID="StatusSuccess">
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#15803D"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Resumen Ejecutivo">
    <Table ss:DefaultColumnWidth="180">
      <Column ss:Width="260"/>
      <Column ss:Width="140"/>
      <Column ss:Width="100"/>
      ${summaryRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Detalle Suscripciones">
    <Table ss:DefaultColumnWidth="140">
      <Column ss:Width="85"/>
      <Column ss:Width="200"/>
      <Column ss:Width="130"/>
      <Column ss:Width="180"/>
      <Column ss:Width="110"/>
      <Column ss:Width="160"/>
      <Column ss:Width="95"/>
      <Column ss:Width="110"/>
      <Column ss:Width="105"/>
      <Column ss:Width="90"/>
      <Column ss:Width="160"/>
      <Column ss:Width="100"/>
      ${detailHeaders}
      ${detailRows}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([spreadsheetXml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte_odoo_mdm_${filterName.toLowerCase().replace(/\s+/g, "_")}_${filenameDate}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
