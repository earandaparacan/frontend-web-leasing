"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { CloseIcon, DownloadIcon, InfoIcon } from "@/components/icons";
import {
  isTerminalMdmDeviceActionJob,
  mdmDeviceActionJobItemLabel,
  mdmDeviceActionJobLabel,
  parseMdmDeviceActionJob,
  parseMdmDeviceActionJobDetail,
  type MdmDeviceActionJob,
  type MdmDeviceActionJobDetail,
} from "./mdm-device-action-job";
import {
  isTerminalMessageJob,
  messageJobItemStatusLabel,
  messageJobStatusLabel,
  parseMessageJob,
  parseMessageJobDetail,
  type MessageJob,
  type MessageJobDetail,
} from "./mdm-message-job";
import styles from "./execution-history.module.css";
import cancellationStyles from "./execution-history-cancellation.module.css";

type Kind = "actions" | "messages";
type ApiResponse = { status?: string; jobs?: unknown; job?: unknown; message?: string; error?: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function errorMessage(data: ApiResponse) {
  return data.message ?? data.error ?? "No se pudo completar la operación.";
}

function downloadSummary(detail: MdmDeviceActionJobDetail | MessageJobDetail, isAction: boolean) {
  const completed = isAction
    ? (detail as MdmDeviceActionJobDetail).succeeded
    : (detail as MessageJobDetail).accepted;
  const rows = [
    ["Ejecución", detail.id], ["Fecha", formatDate(detail.createdAt)],
    ["Sucursal", detail.branchName || "Sin sucursal"],
    ...(!isAction ? [["Etapa", collectionPhaseLabel(detail as MessageJobDetail)]] : []),
    ["Equipos", String(detail.total)],
    [isAction ? "Completados" : "Aceptados", String(completed)], ["Fallidos", String(detail.failed)], [],
    ["Equipo", "Estado", "Intentos", "Último error"],
    ...detail.items.map((item) => [item.deviceId, item.status, String(item.attempts), item.lastError]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ejecucion-${detail.id}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function collectionPhaseLabel(job: MessageJob) {
  return job.collectionPhase === null ? "Sin etapa" : `Etapa ${job.collectionPhase}`;
}

function formatDateForInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeSpreadsheetValue(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function downloadHistory(details: Array<MdmDeviceActionJobDetail | MessageJobDetail>, isAction: boolean) {
  const headers = ["IMEI", "Acción", "Estado", "Exitoso", "Fecha", "Sucursal", ...(!isAction ? ["Etapa", "Mensaje"] : []), "Intentos", "Error", "Ejecución"];
  const rows = [
    ...details.flatMap((job) => job.items.map((item) => [
      item.deviceId,
      isAction ? ((job as MdmDeviceActionJobDetail).action === "lock" ? "Bloquear" : "Desbloquear") : "Mensaje",
      isAction ? mdmDeviceActionJobItemLabel(item.status) : messageJobItemStatusLabel(item.status),
      item.status === (isAction ? "SUCCEEDED" : "ACCEPTED") ? "Sí" : "No",
      formatDate(job.createdAt),
      job.branchName || "Sin sucursal",
      ...(!isAction ? [collectionPhaseLabel(job as MessageJobDetail)] : []),
      ...(!isAction ? [(job as MessageJobDetail).message] : []),
      String(item.attempts),
      item.lastError,
      job.id,
    ])),
  ];
  const spreadsheet = `<!doctype html><html><head><meta charset="utf-8"><style>
    table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
    th { padding: 9px 12px; border: 1px solid #2f5597; color: #fff; background: #305496; font-weight: 700; text-align: left; }
    td { padding: 7px 12px; border: 1px solid #d9e2f3; vertical-align: top; }
    tbody tr:nth-child(even) { background: #eaf2f8; }
    .imei { mso-number-format: "\\@"; }
    .number { mso-number-format: "0"; text-align: right; }
  </style></head><body><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value, index) => `<td class="${index === 0 ? "imei" : index === 6 ? "number" : ""}">${escapeSpreadsheetValue(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  const url = URL.createObjectURL(new Blob([`\ufeff${spreadsheet}`], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `historial-${isAction ? "bloqueo-desbloqueo" : "mensajeria"}-${formatDateForInput(new Date())}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExecutionHistory({ kind, initialAttentionOnly = false, initialJobId = "" }: { kind: Kind; initialAttentionOnly?: boolean; initialJobId?: string }) {
  const isAction = kind === "actions";
  const baseUrl = isAction ? "/api/mdm/action-jobs" : "/api/mdm/message-jobs";
  const editUrl = isAction ? "/panel/dispositivos" : "/panel/mensajeria";
  const backUrl = editUrl;
  const [jobs, setJobs] = useState<Array<MdmDeviceActionJob | MessageJob>>([]);
  const [detail, setDetail] = useState<MdmDeviceActionJobDetail | MessageJobDetail | null>(null);
  const [selectedJobId, setSelectedJobId] = useState(initialJobId);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState("");
  const [rerunning, setRerunning] = useState("");
  const [cancelling, setCancelling] = useState("");
  const [jobToRerun, setJobToRerun] = useState<MdmDeviceActionJob | MessageJob | null>(null);
  const [jobToCancel, setJobToCancel] = useState<MdmDeviceActionJob | null>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(initialAttentionOnly ? "attention" : "all");
  const [period, setPeriod] = useState("30");
  const [page, setPage] = useState(1);
  const [menuJobId, setMenuJobId] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportPeriodType, setExportPeriodType] = useState<"date" | "range">("date");
  const [exportDate, setExportDate] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.status !== "success" || !Array.isArray(data.jobs)) throw new Error(errorMessage(data));
      const parsed = isAction
        ? data.jobs.map(parseMdmDeviceActionJob).filter((job): job is MdmDeviceActionJob => job !== null)
        : data.jobs.map(parseMessageJob).filter((job): job is MessageJob => job !== null);
      setJobs(parsed);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  }, [baseUrl, isAction]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  const openDetail = useCallback(async (jobId: string) => {
    setSelectedJobId(jobId);
    setLoadingDetail(jobId);
    setNotice("");
    try {
      const response = await fetch(`${baseUrl}/${encodeURIComponent(jobId)}`, { cache: "no-store" });
      const data = (await response.json()) as ApiResponse;
      const parsed = isAction ? parseMdmDeviceActionJobDetail(data) : parseMessageJobDetail(data);
      if (!response.ok || data.status !== "success" || !parsed) throw new Error(errorMessage(data));
      setDetail(parsed);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo abrir el detalle.");
      setSelectedJobId("");
    } finally {
      setLoadingDetail("");
    }
  }, [baseUrl, isAction]);

  useEffect(() => {
    if (initialJobId) void openDetail(initialJobId);
  }, [initialJobId, openDetail]);

  async function rerun(jobId: string) {
    setRerunning(jobId);
    setNotice("");
    try {
      const response = await fetch(`${baseUrl}/${encodeURIComponent(jobId)}/rerun`, { method: "POST" });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.status !== "success") throw new Error(errorMessage(data));
      setNotice("La ejecución volvió a quedar en cola.");
      await loadJobs();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo reejecutar.");
    } finally {
      setRerunning("");
    }
  }

  async function cancel(jobId: string) {
    setCancelling(jobId);
    try {
      const response = await fetch(`${baseUrl}/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.status !== "success") throw new Error(errorMessage(data));
      setNotice("La ejecución fue cancelada.");
      await loadJobs();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo cancelar la ejecución.");
    } finally { setCancelling(""); }
  }

  const title = isAction ? "Historial de bloqueo y desbloqueo" : "Historial de mensajería";
  const terminal = (job: MdmDeviceActionJob | MessageJob) =>
    isAction ? isTerminalMdmDeviceActionJob(job as MdmDeviceActionJob) : isTerminalMessageJob(job as MessageJob);
  const label = (job: MdmDeviceActionJob | MessageJob) => isAction
    ? `${(job as MdmDeviceActionJob).action === "lock" ? "Bloquear" : "Desbloquear"} · ${mdmDeviceActionJobLabel(job as MdmDeviceActionJob)}`
    : messageJobStatusLabel((job as MessageJob).status);
  const accepted = (job: MdmDeviceActionJob | MessageJob) => isAction ? (job as MdmDeviceActionJob).succeeded : (job as MessageJob).accepted;
  const status = (job: MdmDeviceActionJob | MessageJob) => job.status;
  const action = (job: MdmDeviceActionJob | MessageJob) => isAction
    ? (job as MdmDeviceActionJob).action === "lock" ? "Bloquear" : "Desbloquear"
    : "Mensaje";
  const canCancel = (job: MdmDeviceActionJob | MessageJob): job is MdmDeviceActionJob =>
    isAction && (job.status === "QUEUED" || job.status === "RUNNING");
  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const periodMs = period === "all" ? null : Number(period) * 24 * 60 * 60 * 1000;
    return jobs.filter((job) => {
      const matchesSearch = !term || [action(job), label(job), job.branchName, job.id].some((value) => value.toLowerCase().includes(term));
      const matchesAction = actionFilter === "all" || action(job).toLowerCase() === actionFilter;
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "attention" && ["QUEUED", "RUNNING", "PARTIAL_SUCCESS", "FAILED"].includes(status(job)))
        || status(job) === statusFilter;
      const matchesPeriod = period === "today"
        ? formatDateForInput(new Date(job.createdAt)) === formatDateForInput(new Date())
        : periodMs === null || Date.now() - new Date(job.createdAt).getTime() <= periodMs;
      return matchesSearch && matchesAction && matchesStatus && matchesPeriod;
    });
  }, [actionFilter, isAction, jobs, period, search, statusFilter]);
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(visibleJobs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedJobs = visibleJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasValidExportPeriod = exportPeriodType === "date"
    ? Boolean(exportDate)
    : Boolean(exportStartDate && exportEndDate && exportStartDate <= exportEndDate);

  function closeExportDialog() { setIsExportOpen(false); }

  async function handleExport() {
    setIsExporting(true);
    try {
      const jobsResponse = await fetch(`${baseUrl}?export=all`, { cache: "no-store" });
      const jobsData = (await jobsResponse.json()) as ApiResponse;
      if (!jobsResponse.ok || jobsData.status !== "success" || !Array.isArray(jobsData.jobs)) throw new Error(errorMessage(jobsData));
      const allJobs = isAction
        ? jobsData.jobs.map(parseMdmDeviceActionJob).filter((job): job is MdmDeviceActionJob => job !== null)
        : jobsData.jobs.map(parseMessageJob).filter((job): job is MessageJob => job !== null);
      const currentTime = Date.now();
      const term = search.trim().toLowerCase();
      const periodMs = period === "all" ? null : Number(period) * 24 * 60 * 60 * 1000;
      const selectedJobs = allJobs.filter((job) => {
        const matchesSearch = !term || [action(job), label(job), job.branchName, job.id].some((value) => value.toLowerCase().includes(term));
        const matchesAction = actionFilter === "all" || action(job).toLowerCase() === actionFilter;
        const matchesStatus = statusFilter === "all"
          || (statusFilter === "attention" && ["QUEUED", "RUNNING", "PARTIAL_SUCCESS", "FAILED"].includes(status(job)))
          || status(job) === statusFilter;
        const matchesPeriod = period === "today"
          ? formatDateForInput(new Date(job.createdAt)) === formatDateForInput(new Date())
          : periodMs === null || currentTime - new Date(job.createdAt).getTime() <= periodMs;
        const jobDate = formatDateForInput(new Date(job.createdAt));
        const matchesExportPeriod = exportPeriodType === "date"
          ? jobDate === exportDate
          : jobDate >= exportStartDate && jobDate <= exportEndDate;
        return matchesSearch && matchesAction && matchesStatus && matchesPeriod && matchesExportPeriod;
      });
      if (selectedJobs.length === 0) {
        setNotice("No hay ejecuciones para exportar en el período seleccionado.");
        return;
      }
      const detailBatchSize = 10;
      const detailBatches = Array.from(
        { length: Math.ceil(selectedJobs.length / detailBatchSize) },
        (_, index) => selectedJobs.slice(index * detailBatchSize, (index + 1) * detailBatchSize),
      );
      const details: Array<MdmDeviceActionJobDetail | MessageJobDetail> = [];
      for (const batch of detailBatches) {
        const batchDetails = await Promise.all(batch.map(async (job) => {
          const response = await fetch(`${baseUrl}/${encodeURIComponent(job.id)}`, { cache: "no-store" });
          const data = (await response.json()) as ApiResponse;
          const parsed = isAction ? parseMdmDeviceActionJobDetail(data) : parseMessageJobDetail(data);
          if (!response.ok || data.status !== "success" || !parsed) throw new Error(errorMessage(data));
          return parsed;
        }));
        details.push(...batchDetails);
      }
      downloadHistory(details, isAction);
      closeExportDialog();
      setNotice("El archivo Excel con el detalle por IMEI se descargó correctamente.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo generar el archivo Excel.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className={`${styles.page} workspace-page`}>
      <Link className={styles.back} href={backUrl}>← Volver al módulo</Link>
      <header className={styles.header}>
        <div><span>HISTORIAL</span><h1>{detail || selectedJobId ? "Detalle de ejecución" : title}</h1></div>
        <button type="button" onClick={() => void loadJobs()} disabled={loading}>{loading ? "Actualizando…" : "Actualizar"}</button>
      </header>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {detail ? (
        <section className={`${styles.detail} ${cancellationStyles.detail}`}>
          <button className={styles.textButton} type="button" onClick={() => { setDetail(null); setSelectedJobId(""); }}>← Todas las ejecuciones</button>
          <div className={styles.detailHeader}>
            <div><div className={styles.detailTitle}><strong>{action(detail)}</strong><span className={`${styles.status} ${styles[`status--${status(detail)}`]}`}>◉ {label(detail).replace(`${action(detail)} · `, "")}</span></div><span>{formatDate(detail.createdAt)} · {detail.branchName || "Sin sucursal"}</span></div>
            <div className={styles.actions}>
              <Link href={`${editUrl}?editarEjecucion=${encodeURIComponent(detail.id)}`}>Editar y reejecutar</Link>
              {canCancel(detail) ? <button type="button" onClick={() => setJobToCancel(detail)} disabled={cancelling === detail.id}>{cancelling === detail.id ? "Cancelando…" : "Cancelar"}</button> : null}
              {terminal(detail) ? <button type="button" onClick={() => setJobToRerun(detail)} disabled={rerunning === detail.id}>{rerunning === detail.id ? "Reejecutando…" : "Reejecutar"}</button> : null}
              <button className={styles.downloadButton} type="button" onClick={() => downloadSummary(detail, isAction)}>Descargar Excel</button>
              <div className={styles.menu}><button className={styles.moreButton} type="button" aria-label="Más opciones" aria-expanded={menuJobId === detail.id} onClick={() => setMenuJobId(menuJobId === detail.id ? "" : detail.id)}>⋮</button>{menuJobId === detail.id ? <div className={styles.menuPanel}><Link href={`${editUrl}?editarEjecucion=${encodeURIComponent(detail.id)}`}>Editar y reejecutar</Link></div> : null}</div>
            </div>
          </div>
          {isAction && (detail as MdmDeviceActionJobDetail).message ? <p className={styles.message}><span aria-hidden="true">i</span>{(detail as MdmDeviceActionJobDetail).message}</p> : null}
          {!isAction ? <p className={styles.message}><span aria-hidden="true">i</span>{(detail as MessageJobDetail).message}</p> : null}
          <dl className={styles.stats}><div><dt>Equipos</dt><dd>{detail.total}</dd></div>{!isAction ? <div><dt>Etapa</dt><dd>{collectionPhaseLabel(detail as MessageJobDetail)}</dd></div> : null}<div><dt>{isAction ? "Completados" : "Aceptados"}</dt><dd>{accepted(detail)}</dd></div><div><dt>Fallidos</dt><dd>{detail.failed}</dd></div>{isAction ? <div><dt>Cancelados</dt><dd>{(detail as MdmDeviceActionJobDetail).cancelled}</dd></div> : null}</dl>
          <section className={styles.results}><h2>Resultado por equipo</h2><div className={styles.items}>{detail.items.map((item) => <article key={item.deviceId}><span className={styles.deviceIcon} aria-hidden="true">▣</span><div><strong>{item.deviceId}</strong><span>Intento{item.attempts === 1 ? "" : "s"} {item.attempts}</span>{item.lastError ? <small>{item.lastError}</small> : null}</div><span className={`${styles.status} ${styles[`status--${item.status}`]}`}>{isAction ? mdmDeviceActionJobItemLabel(item.status) : messageJobItemStatusLabel(item.status)}</span></article>)}</div></section>
        </section>
      ) : selectedJobId ? (
        <section className={styles.detail} aria-busy="true">
          <button className={styles.textButton} type="button" onClick={() => setSelectedJobId("")}>← Todas las ejecuciones</button>
          <p className={styles.empty}>Cargando detalle de la ejecución…</p>
        </section>
      ) : (
        <>
          <section className={styles.filters} aria-label="Filtros del historial">
            <label className={styles.search}><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar ejecución" /></label>
            {isAction ? <select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(1); }} aria-label="Filtrar por acción"><option value="all">Todas las acciones</option><option value="bloquear">Bloquear</option><option value="desbloquear">Desbloquear</option></select> : null}
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filtrar por estado"><option value="all">Todos los estados</option><option value="attention">Requieren seguimiento</option><option value="SUCCEEDED">Completado</option><option value="PARTIAL_SUCCESS">Completado con errores</option><option value="FAILED">Fallido</option><option value="QUEUED">En cola</option><option value="RUNNING">En proceso</option></select>
            <select value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }} aria-label="Filtrar por fecha"><option value="today">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="all">Todo el historial</option></select>
            <button className={styles.exportButton} type="button" onClick={() => setIsExportOpen(true)}><DownloadIcon />Exportar a Excel</button>
          </section>
          {loading ? <p className={styles.empty}>Cargando ejecuciones…</p> : jobs.length === 0 ? <p className={styles.empty}>Todavía no hay ejecuciones registradas.</p> : visibleJobs.length === 0 ? <p className={styles.empty}>No hay ejecuciones que coincidan con los filtros.</p> : (
            <section className={styles.tableWrap} aria-label="Ejecuciones registradas">
              <table><thead><tr><th>Acción</th><th>Estado</th><th>Fecha</th><th>Sucursal</th>{!isAction ? <th>Etapa</th> : null}<th>Resultado</th><th>Acciones</th></tr></thead><tbody>
                {pagedJobs.map((job) => <tr key={job.id} onClick={() => void openDetail(job.id)} className={styles.row}>
                  <td><strong>{action(job)}</strong></td><td><span className={`${styles.status} ${styles[`status--${status(job)}`]}`}>◉ {label(job).replace(`${action(job)} · `, "")}</span></td><td>{formatDate(job.createdAt)}</td><td>{job.branchName || "Sin sucursal"}</td>{!isAction ? <td>{collectionPhaseLabel(job as MessageJob)}</td> : null}<td>{job.total} equipo{job.total === 1 ? "" : "s"} · {accepted(job)} ok · {job.failed} fallidos</td>
                  <td className={styles.rowActions}>{canCancel(job) ? <button type="button" onClick={(event) => { event.stopPropagation(); setJobToCancel(job); }} disabled={cancelling === job.id}>{cancelling === job.id ? "Cancelando…" : "Cancelar"}</button> : <button type="button" onClick={(event) => { event.stopPropagation(); setJobToRerun(job); }} disabled={!terminal(job) || rerunning === job.id}>{rerunning === job.id ? "Reejecutando…" : "Reejecutar"}</button>}<div className={styles.menu}><button type="button" aria-label="Más opciones" aria-expanded={menuJobId === job.id} onClick={(event) => { event.stopPropagation(); setMenuJobId(menuJobId === job.id ? "" : job.id); }}>⋮</button>{menuJobId === job.id ? <div className={styles.menuPanel}><button type="button" onClick={() => { setMenuJobId(""); void openDetail(job.id); }}>Ver detalle</button><Link href={`${editUrl}?editarEjecucion=${encodeURIComponent(job.id)}`}>Editar y reejecutar</Link></div> : null}</div></td>
                </tr>)}
              </tbody></table>
              <footer className={styles.pagination}><span>Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleJobs.length)} de {visibleJobs.length}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((value) => <button className={value === currentPage ? styles.currentPage : undefined} type="button" onClick={() => setPage(value)} key={value}>{value}</button>)}<button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>›</button></div></footer>
            </section>
          )}
        </>
      )}
      <ConfirmationDialog
        isOpen={jobToRerun !== null}
        title="¿Reejecutar esta operación?"
        description={jobToRerun ? `Se volverá a ejecutar ${isAction ? `la acción de ${action(jobToRerun).toLowerCase()}` : "el envío del mensaje"} para los mismos dispositivos.` : ""}
        confirmLabel="Reejecutar"
        onCancel={() => setJobToRerun(null)}
        onConfirm={() => {
          if (!jobToRerun) return;
          const jobId = jobToRerun.id;
          setJobToRerun(null);
          void rerun(jobId);
        }}
      />
      <ConfirmationDialog
        isOpen={jobToCancel !== null}
        title="¿Cancelar esta ejecución?"
        description="Se detendrán los equipos que todavía no fueron enviados. Los equipos ya procesados no se revertirán."
        confirmLabel="Cancelar ejecución"
        onCancel={() => setJobToCancel(null)}
        onConfirm={() => {
          if (!jobToCancel) return;
          const jobId = jobToCancel.id;
          setJobToCancel(null);
          void cancel(jobId);
        }}
      />
      {isExportOpen ? (
        <div className={styles.exportOverlay} role="presentation" onMouseDown={closeExportDialog}>
          <section className={styles.exportDialog} role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.exportDialogHeader}>
              <h2 id="export-title">Exportar historial a Excel</h2>
              <button type="button" onClick={closeExportDialog} aria-label="Cerrar"><CloseIcon /></button>
            </div>
            <p>Seleccioná el período que deseás exportar. El archivo incluirá las ejecuciones que coincidan con los filtros aplicados actualmente.</p>
            <fieldset className={styles.periodType}>
              <legend>Tipo de período</legend>
              <label><input type="radio" name="export-period" checked={exportPeriodType === "date"} onChange={() => setExportPeriodType("date")} />Fecha específica</label>
              <label><input type="radio" name="export-period" checked={exportPeriodType === "range"} onChange={() => setExportPeriodType("range")} />Rango de fechas</label>
            </fieldset>
            {exportPeriodType === "date" ? (
              <label className={styles.dateField}><span>Seleccioná la fecha</span><input type="date" value={exportDate} onChange={(event) => setExportDate(event.target.value)} /></label>
            ) : (
              <div className={styles.dateRange}>
                <label className={styles.dateField}><span>Desde</span><input type="date" value={exportStartDate} onChange={(event) => setExportStartDate(event.target.value)} /></label>
                <label className={styles.dateField}><span>Hasta</span><input type="date" min={exportStartDate || undefined} value={exportEndDate} onChange={(event) => setExportEndDate(event.target.value)} /></label>
              </div>
            )}
            <p className={styles.exportInfo}><InfoIcon />Se generará un archivo Excel con los resultados del historial según los filtros aplicados actualmente.</p>
            <footer className={styles.exportFooter}><button type="button" onClick={closeExportDialog} disabled={isExporting}>Cancelar</button><button type="button" onClick={() => void handleExport()} disabled={!hasValidExportPeriod || isExporting}>{isExporting ? "Exportando…" : "Exportar"}</button></footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
