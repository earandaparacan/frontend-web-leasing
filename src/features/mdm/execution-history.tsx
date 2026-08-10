"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    ["Sucursal", detail.branchName || "Sin sucursal"], ["Equipos", String(detail.total)],
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

export function ExecutionHistory({ kind, initialJobId = "" }: { kind: Kind; initialJobId?: string }) {
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
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState("30");
  const [page, setPage] = useState(1);
  const [menuJobId, setMenuJobId] = useState("");

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
  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const periodMs = period === "all" ? null : Number(period) * 24 * 60 * 60 * 1000;
    return jobs.filter((job) => {
      const matchesSearch = !term || [action(job), label(job), job.branchName, job.id].some((value) => value.toLowerCase().includes(term));
      const matchesAction = actionFilter === "all" || action(job).toLowerCase() === actionFilter;
      const matchesStatus = statusFilter === "all" || status(job) === statusFilter;
      const matchesPeriod = periodMs === null || Date.now() - new Date(job.createdAt).getTime() <= periodMs;
      return matchesSearch && matchesAction && matchesStatus && matchesPeriod;
    });
  }, [actionFilter, isAction, jobs, period, search, statusFilter]);
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(visibleJobs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedJobs = visibleJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={styles.page}>
      <Link className={styles.back} href={backUrl}>← Volver al módulo</Link>
      <header className={styles.header}>
        <div><span>HISTORIAL</span><h1>{detail || selectedJobId ? "Detalle de ejecución" : title}</h1></div>
        <button type="button" onClick={() => void loadJobs()} disabled={loading}>{loading ? "Actualizando…" : "Actualizar"}</button>
      </header>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {detail ? (
        <section className={styles.detail}>
          <button className={styles.textButton} type="button" onClick={() => { setDetail(null); setSelectedJobId(""); }}>← Todas las ejecuciones</button>
          <div className={styles.detailHeader}>
            <div><div className={styles.detailTitle}><strong>{action(detail)}</strong><span className={`${styles.status} ${styles[`status--${status(detail)}`]}`}>◉ {label(detail).replace(`${action(detail)} · `, "")}</span></div><span>{formatDate(detail.createdAt)} · {detail.branchName || "Sin sucursal"}</span></div>
            <div className={styles.actions}>
              <Link href={`${editUrl}?editarEjecucion=${encodeURIComponent(detail.id)}`}>Editar y reejecutar</Link>
              {terminal(detail) ? <button type="button" onClick={() => void rerun(detail.id)} disabled={rerunning === detail.id}>{rerunning === detail.id ? "Reejecutando…" : "Reejecutar"}</button> : null}
              <button className={styles.downloadButton} type="button" onClick={() => downloadSummary(detail, isAction)}>Descargar Excel</button>
              <div className={styles.menu}><button className={styles.moreButton} type="button" aria-label="Más opciones" aria-expanded={menuJobId === detail.id} onClick={() => setMenuJobId(menuJobId === detail.id ? "" : detail.id)}>⋮</button>{menuJobId === detail.id ? <div className={styles.menuPanel}><Link href={`${editUrl}?editarEjecucion=${encodeURIComponent(detail.id)}`}>Editar y reejecutar</Link></div> : null}</div>
            </div>
          </div>
          {isAction && (detail as MdmDeviceActionJobDetail).message ? <p className={styles.message}><span aria-hidden="true">i</span>{(detail as MdmDeviceActionJobDetail).message}</p> : null}
          {!isAction ? <p className={styles.message}><span aria-hidden="true">i</span>{(detail as MessageJobDetail).message}</p> : null}
          <dl className={styles.stats}><div><dt>Equipos</dt><dd>{detail.total}</dd></div><div><dt>{isAction ? "Completados" : "Aceptados"}</dt><dd>{accepted(detail)}</dd></div><div><dt>Fallidos</dt><dd>{detail.failed}</dd></div></dl>
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
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filtrar por estado"><option value="all">Todos los estados</option><option value="SUCCEEDED">Completado</option><option value="PARTIAL_SUCCESS">Completado con errores</option><option value="FAILED">Fallido</option><option value="QUEUED">En cola</option><option value="RUNNING">En proceso</option></select>
            <select value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }} aria-label="Filtrar por fecha"><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="all">Todo el historial</option></select>
          </section>
          {loading ? <p className={styles.empty}>Cargando ejecuciones…</p> : jobs.length === 0 ? <p className={styles.empty}>Todavía no hay ejecuciones registradas.</p> : visibleJobs.length === 0 ? <p className={styles.empty}>No hay ejecuciones que coincidan con los filtros.</p> : (
            <section className={styles.tableWrap} aria-label="Ejecuciones registradas">
              <table><thead><tr><th>Acción</th><th>Estado</th><th>Fecha</th><th>Sucursal</th><th>Resultado</th><th>Acciones</th></tr></thead><tbody>
                {pagedJobs.map((job) => <tr key={job.id} onClick={() => void openDetail(job.id)} className={styles.row}>
                  <td><strong>{action(job)}</strong></td><td><span className={`${styles.status} ${styles[`status--${status(job)}`]}`}>◉ {label(job).replace(`${action(job)} · `, "")}</span></td><td>{formatDate(job.createdAt)}</td><td>{job.branchName || "Sin sucursal"}</td><td>{job.total} equipo{job.total === 1 ? "" : "s"} · {accepted(job)} ok · {job.failed} fallidos</td>
                  <td className={styles.rowActions}><button type="button" onClick={(event) => { event.stopPropagation(); void rerun(job.id); }} disabled={!terminal(job) || rerunning === job.id}>{rerunning === job.id ? "Reejecutando…" : "Reejecutar"}</button><div className={styles.menu}><button type="button" aria-label="Más opciones" aria-expanded={menuJobId === job.id} onClick={(event) => { event.stopPropagation(); setMenuJobId(menuJobId === job.id ? "" : job.id); }}>⋮</button>{menuJobId === job.id ? <div className={styles.menuPanel}><button type="button" onClick={() => { setMenuJobId(""); void openDetail(job.id); }}>Ver detalle</button><Link href={`${editUrl}?editarEjecucion=${encodeURIComponent(job.id)}`}>Editar y reejecutar</Link></div> : null}</div></td>
                </tr>)}
              </tbody></table>
              <footer className={styles.pagination}><span>Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleJobs.length)} de {visibleJobs.length}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((value) => <button className={value === currentPage ? styles.currentPage : undefined} type="button" onClick={() => setPage(value)} key={value}>{value}</button>)}<button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>›</button></div></footer>
            </section>
          )}
        </>
      )}
    </div>
  );
}
