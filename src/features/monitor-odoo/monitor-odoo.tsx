"use client";

import { useMemo, useState } from "react";
import {
  ChartIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  DashboardIcon,
  DeviceIcon,
  FileExcelIcon,
  LockIcon,
  ReceiptIcon,
  RefreshIcon,
  SearchIcon,
  UsersIcon,
} from "@/components/icons";
import { exportMonitorToExcel } from "./monitor-excel-export";
import type { MonitorReportData } from "./monitor-types";
import styles from "./monitor-odoo.module.css";

interface MonitorOdooProps {
  initialData: MonitorReportData;
}

function formatNumber(value: number | undefined | null): string {
  if (value === null || value === undefined) return "0";
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function MonitorOdoo({ initialData }: MonitorOdooProps) {
  const [data, setData] = useState<MonitorReportData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<"all" | "bloqueado" | "al_dia" | "promesa_global" | "tolerancia">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/odoo-monitor/data?refresh=1");
      if (res.ok) {
        const updated = (await res.json()) as MonitorReportData;
        setData(updated);
      }
    } catch {
      // Reintentar silenciosamente
    } finally {
      setIsRefreshing(false);
    }
  }

  // Filtrado ultra rápido en memoria (< 1ms)
  const filteredItems = useMemo(() => {
    const items = data.items || [];
    const query = searchQuery.toLowerCase().trim();

    return items.filter((item) => {
      let matchesFilter = false;
      if (currentFilter === "all") {
        matchesFilter = true;
      } else if (currentFilter === "promesa_global") {
        matchesFilter = item.has_promise;
      } else {
        matchesFilter = item.status_type === currentFilter;
      }

      if (!matchesFilter) return false;
      if (!query) return true;

      const target = `${item.order_name} ${item.partner_name} ${item.imei} ${item.sucursal} ${item.device_product} ${item.fecha_promesa_pago}`.toLowerCase();
      return target.includes(query);
    });
  }, [data.items, currentFilter, searchQuery]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(startIdx, startIdx + PAGE_SIZE);

  function handleFilterChange(filter: typeof currentFilter) {
    setCurrentFilter(filter);
    setCurrentPage(1);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  }

  function handleClearSearch() {
    setSearchQuery("");
    setCurrentPage(1);
  }

  const filterNames: Record<typeof currentFilter, string> = {
    all: "Cartera_Completa",
    bloqueado: "Bloqueados_Morosidad",
    al_dia: "Al_Dia_Regulares",
    promesa_global: "Promesas_de_Pago",
    tolerancia: "Tolerancia_Pago_Reciente",
  };

  function handleExportAll() {
    exportMonitorToExcel(data, data.items || [], "Cartera_Completa");
  }

  function handleExportFiltered() {
    exportMonitorToExcel(data, filteredItems, filterNames[currentFilter]);
  }

  return (
    <div className={styles.page}>
      {/* 1. HERO / HEADER */}
      <div className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.kicker}>AUDITORÍA &amp; CONTROL EN TIEMPO REAL</div>
          <h1>Monitor de Elegibilidad &amp; Bloqueos MDM</h1>
          <p>
            <span>Teklease Cloud • Conexión XML-RPC en vivo</span>
            <span className={styles.dbBadge}>
              Odoo 18: {data.odoo_db || "mergal-master-24463314"}
            </span>
          </p>
        </div>

        <div className={styles.heroActions}>
          <div className={styles.securityNote}>
            <span className={styles.securityDot} />
            <span>
              <strong>Sincronizado: {data.generated_at || "En vivo"}</strong>
              Conexión segura activa
            </span>
          </div>

          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={handleExportAll}
            title="Descargar reporte completo en formato Excel (.xls)"
          >
            <FileExcelIcon width={15} height={15} /> Exportar Excel
          </button>

          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshIcon width={14} height={14} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Actualizando..." : "Actualizar en Vivo"}
          </button>
        </div>
      </div>

      {data.error && (
        <div style={{ padding: "12px 16px", borderRadius: "12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "12px", marginBottom: "24px" }}>
          <strong>Aviso:</strong> {data.error}
        </div>
      )}

      {/* 2. KPI METRIC GRID (TOP 4 TARJETAS) */}
      <div className={styles.metricGrid}>
        {/* METRIC 1: TOTAL CARTERA */}
        <div className={`${styles.metricCard} ${styles.metricCardOrange}`}>
          <div className={styles.metricCardHeader}>
            <span>Cartera Leasing</span>
            <div className={`${styles.metricIcon} ${styles.metricIconOrange}`}>
              <DashboardIcon width={18} height={18} />
            </div>
          </div>
          <div className={styles.metricValue}>{formatNumber(data.total_orders)}</div>
          <div className={styles.metricFooter}>
            <span>{formatNumber(data.total_imeis)} IMEIs con serie</span>
            <span style={{ color: "var(--brand-orange, #ef5c2d)", fontWeight: 750 }}>Plan ID: 1</span>
          </div>
        </div>

        {/* METRIC 2: AL DIA */}
        <div className={`${styles.metricCard} ${styles.metricCardGreen}`}>
          <div className={styles.metricCardHeader}>
            <span>Al Día (0-2 Facturas)</span>
            <div className={`${styles.metricIcon} ${styles.metricIconGreen}`}>
              <CheckIcon width={18} height={18} />
            </div>
          </div>
          <div className={styles.metricValue}>{formatNumber(data.count_al_dia)}</div>
          <div className={styles.metricFooter}>
            <span>Sin riesgo de bloqueo</span>
            <span className={`${styles.statusBadge} ${styles.statusGreen}`}>Habilitado</span>
          </div>
        </div>

        {/* METRIC 3: PROMESAS REGISTRADAS */}
        <div className={`${styles.metricCard} ${styles.metricCardBlue}`}>
          <div className={styles.metricCardHeader}>
            <span>Promesas Registradas</span>
            <div className={`${styles.metricIcon} ${styles.metricIconBlue}`}>
              <UsersIcon width={18} height={18} />
            </div>
          </div>
          <div className={styles.metricValue}>{formatNumber(data.count_promesa)}</div>
          <div className={styles.metricFooter}>
            <span><strong style={{ color: "#0284c7" }}>{data.count_promesas_vigentes}</strong> vigentes</span>
            <span>{data.count_promesas_vencidas} vencidas</span>
          </div>
        </div>

        {/* METRIC 4: TOLERANCIA PAGO RECIENTE */}
        <div className={`${styles.metricCard} ${styles.metricCardAmber}`}>
          <div className={styles.metricCardHeader}>
            <span>Tolerancia Pago Reciente</span>
            <div className={`${styles.metricIcon} ${styles.metricIconAmber}`}>
              <ReceiptIcon width={18} height={18} />
            </div>
          </div>
          <div className={styles.metricValue}>{formatNumber(data.count_tolerancia)}</div>
          <div className={styles.metricFooter}>
            <span>Pagos en últimos 15 días</span>
            <span className={`${styles.statusBadge} ${styles.statusAmber}`}>15 Días Gracia</span>
          </div>
        </div>
      </div>

      {/* 3. ANALYTICS ROW (3 COLUMNAS) */}
      <div className={styles.analyticsGrid}>
        {/* COLUMNA 1: ACCIONES PROYECTADAS */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardHeading}>
              <LockIcon /> Acciones Proyectadas MDM
            </h3>
          </div>
          <div className={styles.actionStack}>
            <div className={styles.actionItemRose}>
              <div className={styles.actionItemHeader}>
                <span className={styles.actionTagRose}>
                  Bloqueos Proyectados
                </span>
                <span className={styles.actionPercent} style={{ color: "#be123c" }}>
                  {data.percent_bloqueados}%
                </span>
              </div>
              <div className={styles.actionNumber}>{formatNumber(data.count_bloqueados)}</div>
              <p className={styles.actionDesc}>Morosos con &ge; 3 facturas sin promesa ni pago.</p>
            </div>

            <div className={styles.actionItemGreen}>
              <div className={styles.actionItemHeader}>
                <span className={styles.actionTagGreen}>
                  Clientes Habilitados
                </span>
                <span className={styles.actionPercent} style={{ color: "#15803d" }}>
                  {data.percent_habilitados}%
                </span>
              </div>
              <div className={styles.actionNumber}>{formatNumber(data.count_habilitados)}</div>
              <p className={styles.actionDesc}>Clientes al día, con promesa activa o pago reciente.</p>
            </div>
          </div>
        </div>

        {/* COLUMNA 2: DISTRIBUCIÓN CARTERA */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardHeading}>
              <ChartIcon /> Distribución de Cartera
            </h3>
          </div>
          <div className={styles.donutWrap}>
            <svg width="140" height="140" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" strokeWidth="14" />
              {/* Al dia */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#10b981"
                strokeWidth="14"
                strokeDasharray={`${(data.count_al_dia / (data.total_orders || 1)) * 238.76} 238.76`}
                strokeDashoffset="0"
                transform="rotate(-90 50 50)"
              />
              {/* Bloqueados */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#ef5c2d"
                strokeWidth="14"
                strokeDasharray={`${(data.count_bloqueados / (data.total_orders || 1)) * 238.76} 238.76`}
                strokeDashoffset={`-${(data.count_al_dia / (data.total_orders || 1)) * 238.76}`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className={styles.donutCenter}>
              <span className={styles.donutCenterValue}>{formatNumber(data.total_orders)}</span>
              <span className={styles.donutCenterLabel}>Total</span>
            </div>
          </div>
          <div className={styles.donutLegend}>
            <div><span className={styles.legendDot} style={{ background: "#10b981" }} />Al Día: <strong>{data.count_al_dia}</strong></div>
            <div><span className={styles.legendDot} style={{ background: "#ef5c2d" }} />Bloqueados: <strong>{data.count_bloqueados}</strong></div>
            <div><span className={styles.legendDot} style={{ background: "#0284c7" }} />Promesas: <strong>{data.count_promesa}</strong></div>
            <div><span className={styles.legendDot} style={{ background: "#f59e0b" }} />Tolerancia: <strong>{data.count_tolerancia}</strong></div>
          </div>
        </div>

        {/* COLUMNA 3: TOP SUCURSALES */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardHeading}>
              <DeviceIcon /> Top Sucursales con Bloqueos
            </h3>
          </div>
          <div className={styles.branchList}>
            {data.top_branches && data.top_branches.length > 0 ? (
              data.top_branches.map((b) => (
                <div key={b.branch_name} className={styles.branchItem}>
                  <div className={styles.branchMeta}>
                    <span>{b.branch_name}</span>
                    <span style={{ fontFamily: "monospace", fontSize: "11px" }}>
                      <strong>{b.count}</strong> <span style={{ color: "#9ca3af", fontWeight: "normal" }}>({b.percent}%)</span>
                    </span>
                  </div>
                  <div className={styles.branchTrack}>
                    <div className={styles.branchBar} style={{ width: `${b.percent}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "#9ca3af", fontSize: "11px", textAlign: "center", margin: "auto" }}>
                No hay datos de sucursales.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 4. EXPLORADOR DE TABLA & LISTA */}
      <div className={styles.tableSection}>
        <div className={styles.tableToolbar}>
          <div className={styles.filterGroup}>
            <button
              type="button"
              className={`${styles.filterBtn} ${currentFilter === "all" ? styles.filterBtnActive : ""}`}
              onClick={() => handleFilterChange("all")}
            >
              Todos ({data.total_orders})
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${currentFilter === "bloqueado" ? styles.filterBtnActive : ""}`}
              onClick={() => handleFilterChange("bloqueado")}
            >
              Bloqueados ({data.count_bloqueados})
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${currentFilter === "al_dia" ? styles.filterBtnActive : ""}`}
              onClick={() => handleFilterChange("al_dia")}
            >
              Al Día ({data.count_al_dia})
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${currentFilter === "promesa_global" ? styles.filterBtnActive : ""}`}
              onClick={() => handleFilterChange("promesa_global")}
            >
              Promesas ({data.count_promesa})
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${currentFilter === "tolerancia" ? styles.filterBtnActive : ""}`}
              onClick={() => handleFilterChange("tolerancia")}
            >
              Tolerancia ({data.count_tolerancia})
            </button>
          </div>

          <div className={styles.toolbarRight}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={handleExportFiltered}
              style={{ padding: "7px 12px", fontSize: "11px" }}
              title="Descargar registros de la pestaña activa en Excel"
            >
              <FileExcelIcon width={13} height={13} /> Descargar Pestaña
            </button>

            <div className={styles.searchField}>
              <span className={styles.searchIcon}>
                <SearchIcon width={14} height={14} />
              </span>
              <input
                type="text"
                placeholder="Buscar IMEI, cliente u orden..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={handleClearSearch}
                  title="Limpiar búsqueda"
                >
                  <CloseIcon width={12} height={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4A. VISTA TABLA DESKTOP CON COLGROUP DEFINIDO */}
        <div className={styles.tableWrap}>
          <table>
            <colgroup>
              <col style={{ width: "95px" }} />
              <col style={{ width: "230px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "220px" }} />
              <col style={{ width: "175px" }} />
              <col style={{ width: "125px" }} />
              <col style={{ width: "175px" }} />
              <col style={{ width: "135px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>IMEI</th>
                <th>Modelo</th>
                <th>Sucursal / Operador</th>
                <th style={{ textAlign: "center" }}>Facturas Vencidas</th>
                <th>Promesa / Tolerancia</th>
                <th style={{ textAlign: "center" }}>Estado MDM</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length > 0 ? (
                pageItems.map((item) => (
                  <tr key={`${item.order_name}-${item.imei}`}>
                    <td>
                      <span className={styles.orderNumber}>{item.order_name}</span>
                    </td>
                    <td>
                      <span className={styles.partnerName} title={item.partner_name}>
                        {item.partner_name}
                      </span>
                    </td>
                    <td>
                      <span className={styles.imeiCode}>
                        {item.imei || <span style={{ color: "#9ca3af" }}>Sin IMEI</span>}
                      </span>
                    </td>
                    <td>
                      <span className={styles.deviceModel} title={item.device_product}>
                        {item.device_product || "Sin Modelo"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.cellStack}>
                        <span className={styles.cellTitle}>{item.sucursal || "Sin Sucursal"}</span>
                        <span className={styles.cellSubtitle}>{item.operador || "Sin Asignar"}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`${styles.overdueTag} ${item.overdue_count >= 3 ? styles.overdueHigh : styles.overdueNormal}`}>
                        {item.overdue_count}
                      </span>
                    </td>
                    <td>
                      {item.has_promise ? (
                        !item.promesa_vencida ? (
                          <span className={`${styles.statusBadge} ${styles.statusBlue}`}>
                            <ClockIcon width={11} height={11} />
                            <span style={{ fontFamily: "monospace" }}>{item.fecha_promesa_pago}</span>
                            <span style={{ background: "#0284c7", color: "#ffffff", padding: "1px 4px", borderRadius: "3px", fontSize: "8px", fontWeight: "bold" }}>
                              VIGENTE
                            </span>
                          </span>
                        ) : (
                          <span className={styles.statusBadge} style={{ background: "#f3f4f6", color: "#4b5563", border: "1px solid #e5e7eb" }}>
                            <span style={{ fontFamily: "monospace" }}>{item.fecha_promesa_pago}</span>
                            <span style={{ background: "#6b7280", color: "#ffffff", padding: "1px 4px", borderRadius: "3px", fontSize: "8px" }}>
                              VENCIDA
                            </span>
                          </span>
                        )
                      ) : item.has_recent_payment ? (
                        <span className={`${styles.statusBadge} ${styles.statusAmber}`}>
                          <ReceiptIcon width={11} height={11} /> Pago &le; 15d
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {item.status_type === "bloqueado" && <span className={`${styles.statusBadge} ${styles.statusRose}`}>Bloqueado</span>}
                      {item.status_type === "promesa" && <span className={`${styles.statusBadge} ${styles.statusBlue}`}>Promesa Vigente</span>}
                      {item.status_type === "tolerancia" && <span className={`${styles.statusBadge} ${styles.statusAmber}`}>Tolerancia Pago</span>}
                      {item.status_type === "al_dia" && <span className={`${styles.statusBadge} ${styles.statusGreen}`}>Al Día</span>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
                    No se encontraron suscripciones con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4B. VISTA MÓVIL / RESPONSIVE LIST */}
        <div className={styles.mobileCardList}>
          {pageItems.length > 0 ? (
            pageItems.map((item) => (
              <div key={`m-${item.order_name}-${item.imei}`} className={styles.mobileCardItem}>
                <div className={styles.mobileCardHeader}>
                  <span className={styles.orderNumber}>{item.order_name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className={`${styles.overdueTag} ${item.overdue_count >= 3 ? styles.overdueHigh : styles.overdueNormal}`}>
                      {item.overdue_count}
                    </span>
                    {item.status_type === "bloqueado" && <span className={`${styles.statusBadge} ${styles.statusRose}`}>Bloqueado</span>}
                    {item.status_type === "promesa" && <span className={`${styles.statusBadge} ${styles.statusBlue}`}>Promesa</span>}
                    {item.status_type === "tolerancia" && <span className={`${styles.statusBadge} ${styles.statusAmber}`}>Tolerancia</span>}
                    {item.status_type === "al_dia" && <span className={`${styles.statusBadge} ${styles.statusGreen}`}>Al Día</span>}
                  </div>
                </div>

                <div className={styles.mobileClientName}>{item.partner_name}</div>

                <div className={styles.mobileDetailsGrid}>
                  <span>IMEI: <strong>{item.imei || "Sin IMEI"}</strong></span>
                  <span>Sucursal: <strong>{item.sucursal || "Sin Sucursal"}</strong></span>
                  <span>Modelo: <strong>{item.device_product || "Sin Modelo"}</strong></span>
                  <span>Operador: <strong>{item.operador || "Sin Asignar"}</strong></span>
                  <span>Promesa: <strong>{item.fecha_promesa_pago || (item.has_recent_payment ? "Pago reciente" : "—")}</strong></span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: "28px", color: "#6b7280", fontSize: "12px" }}>
              No se encontraron registros.
            </div>
          )}
        </div>

        {/* 5. PAGINACIÓN */}
        <div className={styles.tableFooter}>
          <span>
            Mostrando {filteredItems.length > 0 ? startIdx + 1 : 0} - {Math.min(startIdx + PAGE_SIZE, filteredItems.length)} de {filteredItems.length} registros
          </span>

          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Anterior
            </button>
            <span className={styles.pageCount}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
