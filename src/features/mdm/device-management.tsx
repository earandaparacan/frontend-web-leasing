"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, LockIcon, ShieldIcon } from "@/components/icons";
import {
  isTerminalMdmDeviceActionJob,
  mdmDeviceActionJobLabel,
  parseMdmDeviceActionJob,
  parseMdmDeviceActionJobDetail,
  type MdmDeviceActionJob,
  type MdmDeviceActionJobDetail,
} from "./mdm-device-action-job";
import styles from "./device-management.module.css";

type Device = {
  device_id: string;
  imei?: string;
  db_id?: number;
  configuration_name?: string;
  config_name?: string;
  groups?: string;
  group_name?: string;
  last_active?: string;
  status?: string;
  description?: string;
  permissions?: number[] | null;
  files_status?: string | null;
  apps_status?: string | null;
  found: boolean;
  error?: string;
};

type QueryResponse = {
  status?: string;
  mode?: string;
  results?: unknown;
  message?: string;
  error?: string;
};

type ActionJobResponse = {
  status?: string;
  job?: unknown;
  message?: string;
  error?: string;
};

type CapabilitiesResponse = {
  status?: string;
  capabilities?: unknown;
};

type TemplateResponse = {
  status?: string;
  templates?: unknown;
  template?: unknown;
  message?: string;
  error?: string;
};

type ActionJobHistoryResponse = {
  status?: string;
  jobs?: unknown;
  message?: string;
  error?: string;
};

type MdmBranch = {
  id: number;
  name: string;
};

type BranchResponse = {
  status?: string;
  branches?: unknown;
  message?: string;
  error?: string;
};

type LogEntry = {
  id: string;
  time: string;
  message: string;
  tone: "info" | "success" | "error";
};

function nowLabel() {
  return new Intl.DateTimeFormat("es-PY", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function responseMessage(data: { message?: string; error?: string }) {
  return data.message ?? data.error ?? "No se pudo completar la operación.";
}

function isDevice(value: unknown): value is Device {
  if (typeof value !== "object" || value === null) return false;
  const device = value as Record<string, unknown>;
  return (
    typeof device.device_id === "string" &&
    typeof device.found === "boolean" &&
    (device.db_id === undefined || typeof device.db_id === "number")
  );
}

function isMdmBranch(value: unknown): value is MdmBranch {
  if (typeof value !== "object" || value === null) return false;
  const branch = value as Record<string, unknown>;
  return (
    typeof branch.id === "number" &&
    Number.isSafeInteger(branch.id) &&
    branch.id > 0 &&
    typeof branch.name === "string" &&
    branch.name.trim().length > 0
  );
}

function parseIdentifiers(value: string) {
  return [...new Set(value.split(/[\r\n,;\t]+/).map((item) => item.trim()).filter(Boolean))];
}

function statusTone(status?: string | null) {
  const normalized = status?.toUpperCase() ?? "";

  if (["SUCCESS", "UP_TO_DATE"].includes(normalized)) return "good";
  if (["PENDING", "PENDING_DOWNLOAD"].includes(normalized)) return "warning";
  if (!normalized) return "neutral";
  return "bad";
}

function statusLabel(status?: string | null) {
  if (!status) return "Sin datos";

  const labels: Record<string, string> = {
    SUCCESS: "Al día",
    UP_TO_DATE: "Al día",
    PENDING: "Pendiente",
    PENDING_DOWNLOAD: "Pendiente",
  };

  return labels[status.toUpperCase()] ?? "Revisar";
}

function formatJobDate(value: string) {
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const ACTIVE_ACTION_JOB_KEY = "teklease-active-mdm-device-action-job";

export function DeviceManagement() {
  const [input, setInput] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [branches, setBranches] = useState<MdmBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [pendingAction, setPendingAction] = useState<"lock" | "unlock" | null>(null);
  const [activeJobId, setActiveJobId] = useState("");
  const [activeJob, setActiveJob] = useState<MdmDeviceActionJob | null>(null);
  const [jobHistory, setJobHistory] = useState<MdmDeviceActionJob[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [rerunningJobId, setRerunningJobId] = useState("");
  const [jobDetail, setJobDetail] = useState<MdmDeviceActionJobDetail | null>(null);
  const [loadingDetailJobId, setLoadingDetailJobId] = useState("");
  const [isRetryingJob, setIsRetryingJob] = useState(false);
  const [maxSpecificDevices, setMaxSpecificDevices] = useState(1000);
  const [queryBatchSize, setQueryBatchSize] = useState(20);
  const idempotencyKeyRef = useRef("");
  const [notice, setNotice] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "initial",
      time: "Sistema",
      message: "Panel listo para consultar dispositivos.",
      tone: "info",
    },
  ]);

  const identifiers = useMemo(() => parseIdentifiers(input), [input]);
  const foundDevices = devices.filter((device) => device.found);
  const visibleDevices = devices.filter((device) => {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return [device.device_id, device.imei, device.description, device.groups]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(term));
  });
  const selectedDevices = foundDevices.filter((device) => selected.has(device.device_id));
  const hasTargets = selectedDevices.length > 0;
  const actionInProgress = Boolean(activeJob && !isTerminalMdmDeviceActionJob(activeJob));
  const allVisibleSelected =
    visibleDevices.some((device) => device.found) &&
    visibleDevices.filter((device) => device.found).every((device) => selected.has(device.device_id));

  async function loadJobHistory() {
    try {
      const response = await fetch("/api/mdm/action-jobs", { cache: "no-store" });
      const data = (await response.json()) as ActionJobHistoryResponse;
      if (!response.ok || data.status !== "success" || !Array.isArray(data.jobs)) {
        throw new Error(responseMessage(data));
      }
      const parsedJobs = data.jobs.map(parseMdmDeviceActionJob);
      if (parsedJobs.some((job) => job === null)) {
        throw new Error("El historial de acciones contiene datos incompletos.");
      }
      setJobHistory(
        parsedJobs.filter(
          (job): job is MdmDeviceActionJob => job !== null,
        ),
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se pudo cargar el historial.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadTemplates() {
      try {
        const response = await fetch("/api/mdm/lock-templates", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as TemplateResponse;
        if (
          !response.ok ||
          data.status !== "success" ||
          !Array.isArray(data.templates) ||
          !data.templates.every(
            (template) => typeof template === "string" && template.length <= 500,
          )
        ) {
          throw new Error(responseMessage(data));
        }
        setTemplates(data.templates);
      } catch (error) {
        if (controller.signal.aborted) return;
        setNotice(
          error instanceof Error ? error.message : "No se pudieron cargar las plantillas.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoadingTemplates(false);
      }
    }

    void loadTemplates();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void loadJobHistory();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBranches() {
      try {
        const response = await fetch("/api/mdm/branches", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as BranchResponse;
        if (
          !response.ok ||
          data.status !== "success" ||
          !Array.isArray(data.branches) ||
          !data.branches.every(isMdmBranch)
        ) {
          throw new Error(responseMessage(data));
        }
        setBranches(data.branches);
      } catch (error) {
        if (controller.signal.aborted) return;
        setNotice(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las sucursales.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoadingBranches(false);
      }
    }

    void loadBranches();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const storedJobId = window.localStorage.getItem(ACTIVE_ACTION_JOB_KEY);
    const restoreTimer = storedJobId
      ? window.setTimeout(() => setActiveJobId(storedJobId), 0)
      : undefined;

    const controller = new AbortController();
    async function loadCapabilities() {
      try {
        const response = await fetch("/api/mdm/capabilities", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as CapabilitiesResponse;
        if (!response.ok || data.status !== "success" || !data.capabilities) return;
        const capabilities = data.capabilities as Record<string, unknown>;
        if (
          typeof capabilities.max_specific_devices === "number" &&
          Number.isSafeInteger(capabilities.max_specific_devices) &&
          capabilities.max_specific_devices > 0
        ) {
          setMaxSpecificDevices(capabilities.max_specific_devices);
        }
        if (
          typeof capabilities.query_batch_size === "number" &&
          Number.isSafeInteger(capabilities.query_batch_size) &&
          capabilities.query_batch_size > 0
        ) {
          setQueryBatchSize(capabilities.query_batch_size);
        }
      } catch {
        // Los límites seguros por defecto permiten continuar si falla esta consulta auxiliar.
      }
    }

    void loadCapabilities();
    return () => {
      controller.abort();
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
    };
  }, []);

  const activeJobTerminal = activeJob ? isTerminalMdmDeviceActionJob(activeJob) : false;
  useEffect(() => {
    if (!activeJobId || activeJobTerminal) return;

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    async function pollJob() {
      try {
        const response = await fetch(`/api/mdm/action-jobs/${encodeURIComponent(activeJobId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as ActionJobResponse;
        const job = parseMdmDeviceActionJob(data.job);
        if (!response.ok || data.status !== "success" || !job) {
          throw new Error(responseMessage(data));
        }
        setActiveJob(job);
        void loadJobHistory();
        if (isTerminalMdmDeviceActionJob(job)) {
          window.localStorage.removeItem(ACTIVE_ACTION_JOB_KEY);
          setNotice(
            job.status === "SUCCEEDED"
              ? `La acción terminó correctamente en ${job.succeeded} dispositivo(s).`
              : `La acción terminó con ${job.failed} dispositivo(s) fallido(s).`,
          );
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setNotice(error instanceof Error ? error.message : "No se pudo consultar la acción.");
      }
      timeoutId = setTimeout(pollJob, 2000);
    }

    void pollJob();
    return () => {
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeJobId, activeJobTerminal]);

  function addLog(messageText: string, tone: LogEntry["tone"] = "info") {
    setLogs((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        time: nowLabel(),
        message: messageText,
        tone,
      },
    ]);
  }

  async function queryDevices(deviceIdentifiers = identifiers) {
    if (deviceIdentifiers.length === 0) {
      setNotice("Ingresá al menos un IMEI o Device ID.");
      return;
    }

    if (deviceIdentifiers.length > maxSpecificDevices) {
      setNotice(`Podés consultar hasta ${maxSpecificDevices} dispositivos por vez.`);
      return;
    }

    setIsQuerying(true);
    setNotice("");
    addLog(`Consultando ${deviceIdentifiers.length} dispositivo(s)…`);

    try {
      const validResults: Device[] = [];
      for (let index = 0; index < deviceIdentifiers.length; index += queryBatchSize) {
        const batch = deviceIdentifiers.slice(index, index + queryBatchSize);
        const response = await fetch("/api/mdm/devices/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ devices: batch }),
        });
        const data = (await response.json()) as QueryResponse;

        if (!response.ok || data.status !== "success" || !Array.isArray(data.results)) {
          throw new Error(responseMessage(data));
        }
        const batchResults = data.results.filter(isDevice);
        if (batchResults.length !== data.results.length) {
          throw new Error("El servicio MDM devolvió datos incompletos.");
        }
        validResults.push(...batchResults);
      }

      setDevices(validResults);
      setSelected(new Set());
      const found = validResults.filter((device) => device.found).length;
      addLog(
        `Consulta completada: ${found} encontrado(s) y ${validResults.length - found} sin registro.`,
        "success",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "No se pudo consultar el servicio MDM.";
      setNotice(errorMessage);
      addLog(errorMessage, "error");
    } finally {
      setIsQuerying(false);
    }
  }

  async function handleQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await queryDevices();
  }

  function toggleDevice(deviceId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      visibleDevices.forEach((device) => {
        if (!device.found) return;
        if (allVisibleSelected) next.delete(device.device_id);
        else next.add(device.device_id);
      });
      return next;
    });
  }

  function applyTemplate(value: string) {
    if (value) setMessage(value);
  }

  async function saveTemplate() {
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      setNotice("Escribí un mensaje antes de guardarlo como plantilla.");
      return;
    }
    if (templates.includes(cleanMessage)) {
      setNotice("Ese mensaje ya está guardado como plantilla.");
      return;
    }

    setIsSavingTemplate(true);
    setNotice("");
    try {
      const response = await fetch("/api/mdm/lock-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cleanMessage }),
      });
      const data = (await response.json()) as TemplateResponse;
      if (!response.ok || data.status !== "success" || typeof data.template !== "string") {
        throw new Error(responseMessage(data));
      }
      const savedTemplate = data.template;
      setTemplates((current) =>
        current.includes(savedTemplate) ? current : [...current, savedTemplate],
      );
      setNotice("Plantilla guardada en el servidor.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se pudo guardar la plantilla.",
      );
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function triggerAction(action: "lock" | "unlock") {
    if (!hasTargets || actionInProgress) return;
    const selectedBranchId = Number(branchId);
    if (!Number.isSafeInteger(selectedBranchId) || selectedBranchId <= 0) {
      setNotice("Seleccioná una sucursal antes de ejecutar la acción.");
      return;
    }
    if (
      selectedDevices.some((device) => !Number.isSafeInteger(device.db_id))
    ) {
      setNotice("Volvé a consultar: hay dispositivos sin identificador interno de Headwind.");
      return;
    }

    const actionLabel = action === "lock" ? "bloquear" : "desbloquear";
    const targetLabel = `${selectedDevices.length} dispositivo(s)`;
    if (!window.confirm(`¿Confirmás ${actionLabel} ${targetLabel}?`)) {
      return;
    }

    setPendingAction(action);
    setNotice("");
    addLog(`Enviando comando para ${actionLabel} ${targetLabel}…`);

    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = `action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const response = await fetch("/api/mdm/action-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          scope: "devices",
          devices: selectedDevices.map((device) => ({
            number: device.device_id,
            db_id: device.db_id,
          })),
          action,
          branch_id: selectedBranchId,
          message: action === "lock" ? message.trim() : "",
        }),
      });
      const data = (await response.json()) as ActionJobResponse;
      const job = parseMdmDeviceActionJob(data.job);

      if (!response.ok || data.status !== "success" || !job) {
        throw new Error(responseMessage(data));
      }

      idempotencyKeyRef.current = "";
      setActiveJobId(job.id);
      setActiveJob(job);
      void loadJobHistory();
      window.localStorage.setItem(ACTIVE_ACTION_JOB_KEY, job.id);
      addLog(
        `Acción ${action === "lock" ? "de bloqueo" : "de desbloqueo"} creada para ${targetLabel}.`,
        "success",
      );
      setSelected(new Set());
      if (action === "lock") setMessage("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "No se pudo enviar el comando al MDM.";
      setNotice(errorMessage);
      addLog(errorMessage, "error");
    } finally {
      setPendingAction(null);
    }
  }

  async function retryFailedDevices() {
    if (!activeJob || !isTerminalMdmDeviceActionJob(activeJob)) return;
    setIsRetryingJob(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/mdm/action-jobs/${encodeURIComponent(activeJob.id)}/retry-failures`,
        { method: "POST" },
      );
      const data = (await response.json()) as ActionJobResponse;
      const job = parseMdmDeviceActionJob(data.job);
      if (!response.ok || data.status !== "success" || !job) {
        throw new Error(responseMessage(data));
      }
      setActiveJob(job);
      void loadJobHistory();
      setActiveJobId(job.id);
      window.localStorage.setItem(ACTIVE_ACTION_JOB_KEY, job.id);
      addLog(`Reintentando ${job.pending} dispositivo(s) fallido(s).`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo reintentar la acción.");
    } finally {
      setIsRetryingJob(false);
    }
  }

  async function handleRerun(job: MdmDeviceActionJob) {
    if (!isTerminalMdmDeviceActionJob(job) || rerunningJobId) return;
    if (!window.confirm("¿Volvés a ejecutar esta acción con los mismos dispositivos?")) {
      return;
    }

    setRerunningJobId(job.id);
    setNotice("");
    try {
      const response = await fetch(
        `/api/mdm/action-jobs/${encodeURIComponent(job.id)}/rerun`,
        { method: "POST" },
      );
      const data = (await response.json()) as ActionJobResponse;
      const rerun = parseMdmDeviceActionJob(data.job);
      if (!response.ok || data.status !== "success" || !rerun) {
        throw new Error(responseMessage(data));
      }
      setActiveJob(rerun);
      setActiveJobId(rerun.id);
      window.localStorage.setItem(ACTIVE_ACTION_JOB_KEY, rerun.id);
      setJobHistory((current) => [rerun, ...current]);
      addLog("La acción volvió a quedar en cola.", "success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo volver a ejecutar la acción.");
    } finally {
      setRerunningJobId("");
    }
  }

  async function handleViewDetail(job: MdmDeviceActionJob) {
    setLoadingDetailJobId(job.id);
    try {
      const response = await fetch(
        `/api/mdm/action-jobs/${encodeURIComponent(job.id)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as ActionJobResponse;
      const detail = parseMdmDeviceActionJobDetail(data);
      if (!response.ok || data.status !== "success" || !detail) {
        throw new Error(responseMessage(data));
      }
      setJobDetail(detail);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo cargar el detalle de la acción.");
    } finally {
      setLoadingDetailJobId("");
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>Gestión MDM</span>
          <h1>Bloqueo y desbloqueo</h1>
          <p>Consultá el estado real de tus equipos y ejecutá acciones masivas de forma segura.</p>
        </div>
        <div className={styles.securityNote}>
          <ShieldIcon />
          <span>
            <strong>Entorno protegido</strong>
            Acciones registradas y monitoreadas
          </span>
        </div>
      </section>

      <section className={styles.queryCard}>
        <form onSubmit={handleQuery}>
          <div className={styles.queryHeading}>
            <div>
              <span className={styles.step}>01</span>
              <div>
                <h2>Ingresá los dispositivos</h2>
                <p>Un IMEI o Device ID por línea. También podés pegar una columna desde Excel.</p>
              </div>
            </div>
            <span className={styles.counter}>{identifiers.length} / {maxSpecificDevices}</span>
          </div>

          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setNotice("");
            }}
            placeholder={"356938035643809\nTKL-3019\nTKL-2296"}
            aria-label="IMEIs o Device IDs"
            rows={5}
          />

          <div className={styles.queryFooter}>
            <span>{identifiers.length ? `${identifiers.length} dispositivo(s) detectado(s)` : "Ningún dispositivo ingresado"}</span>
            <button type="submit" disabled={isQuerying || identifiers.length === 0}>
              {isQuerying ? <span className="spinner" /> : <SearchIcon />}
              {isQuerying ? "Consultando…" : "Consultar estado"}
            </button>
          </div>
        </form>
      </section>

      {notice ? (
        <div className={styles.notice} role="alert">
          <AlertIcon />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Cerrar mensaje">×</button>
        </div>
      ) : null}

      {devices.length > 0 ? (
        <section className={styles.results}>
          <div className={styles.resultsHeading}>
            <div>
              <span className={styles.step}>02</span>
              <div>
                <h2>Vista previa de dispositivos</h2>
                <p>Verificá el estado antes de ejecutar cualquier acción.</p>
              </div>
            </div>
            <div className={styles.resultTools}>
              <label className={styles.searchField}>
                <SearchIcon />
                <span className="sr-only">Filtrar resultados</span>
                <input
                  type="search"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Filtrar resultados"
                />
              </label>
              <span className={styles.resultCount}>{foundDevices.length} encontrados</span>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th className={styles.checkColumn}>
                    <SelectionCheckbox checked={allVisibleSelected} onChange={toggleVisible} label="Seleccionar visibles" />
                  </th>
                  <th>Equipo</th>
                  <th>Asignación</th>
                  <th>Salud MDM</th>
                  <th>Última conexión</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibleDevices.map((device) => (
                  <DeviceRow
                    key={`${device.device_id}-${device.found}`}
                    device={device}
                    checked={selected.has(device.device_id)}
                    onToggle={() => toggleDevice(device.device_id)}
                  />
                ))}
              </tbody>
            </table>
            {visibleDevices.length === 0 ? (
              <div className={styles.empty}>No hay resultados que coincidan con el filtro.</div>
            ) : null}
          </div>

          {selectedDevices.length > 0 ? (
            <div className={styles.actionPanel}>
              <div className={styles.actionPanelHeading}>
                <div>
                  <span className={styles.selectedCount}>{selectedDevices.length}</span>
                  <span>
                    <strong>Equipo{selectedDevices.length === 1 ? "" : "s"} seleccionado{selectedDevices.length === 1 ? "" : "s"}</strong>
                    Listos para ejecutar una acción
                  </span>
                </div>
                <button type="button" onClick={() => setSelected(new Set())}>Limpiar selección</button>
              </div>

              <div className={styles.actionFields}>
                <label>
                  <span>Sucursal</span>
                  <select
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    disabled={isLoadingBranches || pendingAction !== null}
                  >
                    <option value="">
                      {isLoadingBranches ? "Cargando sucursales…" : "Seleccionar sucursal"}
                    </option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Mensaje de bloqueo</span>
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Mensaje visible en el dispositivo (opcional)"
                    maxLength={500}
                  />
                </label>
                <label>
                  <span>Plantilla</span>
                  <select
                    defaultValue=""
                    onChange={(event) => applyTemplate(event.target.value)}
                    disabled={isLoadingTemplates || templates.length === 0}
                  >
                    <option value="">
                      {isLoadingTemplates
                        ? "Cargando plantillas…"
                        : templates.length === 0
                          ? "Sin plantillas disponibles"
                          : "Seleccionar plantilla"}
                    </option>
                    {templates.map((template) => (
                      <option key={template} value={template}>{template}</option>
                    ))}
                  </select>
                </label>
                <button
                  className={styles.saveTemplate}
                  type="button"
                  onClick={saveTemplate}
                  disabled={isSavingTemplate}
                >
                  {isSavingTemplate ? "Guardando…" : "Guardar mensaje"}
                </button>
              </div>

              <div className={styles.actionButtons}>
                <button
                  className={styles.unlockButton}
                  type="button"
                  onClick={() => triggerAction("unlock")}
                  disabled={pendingAction !== null || actionInProgress || !branchId}
                >
                  <UnlockIcon />
                  {pendingAction === "unlock" ? "Desbloqueando…" : "Desbloquear seleccionados"}
                </button>
                <button
                  className={styles.lockButton}
                  type="button"
                  onClick={() => triggerAction("lock")}
                  disabled={pendingAction !== null || actionInProgress || !branchId}
                >
                  <LockIcon />
                  {pendingAction === "lock" ? "Bloqueando…" : "Bloquear seleccionados"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeJob ? (
        <section className={styles.jobProgress} aria-live="polite">
          <div className={styles.jobProgressHeading}>
            <div>
              <span>{activeJob.action === "lock" ? <LockIcon /> : <UnlockIcon />}</span>
              <div>
                <small>PROCESAMIENTO EN SEGUNDO PLANO</small>
                <strong>{mdmDeviceActionJobLabel(activeJob)}</strong>
              </div>
            </div>
            <small>{activeJob.id}</small>
          </div>
          <progress
            max={Math.max(activeJob.total, 1)}
            value={activeJob.succeeded + activeJob.failed}
          />
          <div className={styles.jobStats}>
            <div><span>Total</span><strong>{activeJob.total}</strong></div>
            <div><span>Pendientes</span><strong>{activeJob.pending}</strong></div>
            <div><span>Completados</span><strong>{activeJob.succeeded}</strong></div>
            <div><span>Fallidos</span><strong>{activeJob.failed}</strong></div>
          </div>
          {activeJob.lastError ? <p>{activeJob.lastError}</p> : null}
          {isTerminalMdmDeviceActionJob(activeJob) && activeJob.failed > 0 ? (
            <button type="button" onClick={retryFailedDevices} disabled={isRetryingJob}>
              {isRetryingJob ? "Reintentando…" : "Reintentar fallidos"}
            </button>
          ) : null}
        </section>
      ) : null}

      <section className={styles.history} aria-labelledby="action-history-heading">
        <div className={styles.historyHeading}>
          <div>
            <span>HISTORIAL</span>
            <h2 id="action-history-heading">Ejecuciones recientes</h2>
          </div>
          <button type="button" onClick={() => void loadJobHistory()} disabled={isLoadingHistory}>
            {isLoadingHistory ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
        {isLoadingHistory ? (
          <p className={styles.historyEmpty}>Cargando ejecuciones…</p>
        ) : jobHistory.length === 0 ? (
          <p className={styles.historyEmpty}>Todavía no hay acciones registradas.</p>
        ) : (
          <div className={styles.historyList}>
            {jobHistory.map((job) => (
              <article className={styles.historyItem} key={job.id}>
                <div>
                  <strong>{job.action === "lock" ? "Bloquear" : "Desbloquear"} · {mdmDeviceActionJobLabel(job)}</strong>
                  <small>{formatJobDate(job.createdAt)} · {job.branchName || "Sin sucursal"}</small>
                </div>
                <dl>
                  <div><dt>Equipos</dt><dd>{job.total}</dd></div>
                  <div><dt>Completados</dt><dd>{job.succeeded}</dd></div>
                  <div><dt>Fallidos</dt><dd>{job.failed}</dd></div>
                </dl>
                <div className={styles.historyActions}>
                  {job.rerunOf ? <small>Reejecución</small> : null}
                  <button
                    type="button"
                    onClick={() => void handleViewDetail(job)}
                    disabled={Boolean(loadingDetailJobId)}
                  >
                    {loadingDetailJobId === job.id ? "Abriendo…" : "Ver detalle"}
                  </button>
                  {isTerminalMdmDeviceActionJob(job) ? (
                    <button
                      type="button"
                      onClick={() => void handleRerun(job)}
                      disabled={Boolean(rerunningJobId)}
                    >
                      {rerunningJobId === job.id ? "Reejecutando…" : "Volver a ejecutar"}
                    </button>
                  ) : <small>En proceso</small>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {jobDetail ? (
        <section className={styles.jobDetail} aria-labelledby="action-detail-heading">
          <div className={styles.jobDetailHeading}>
            <div>
              <span>DETALLE DE EJECUCIÓN</span>
              <h2 id="action-detail-heading">
                {jobDetail.action === "lock" ? "Bloquear" : "Desbloquear"} · {mdmDeviceActionJobLabel(jobDetail)}
              </h2>
              <small>{formatJobDate(jobDetail.createdAt)} · {jobDetail.branchName || "Sin sucursal"}</small>
            </div>
            <button type="button" onClick={() => setJobDetail(null)}>Cerrar</button>
          </div>
          {jobDetail.action === "lock" && jobDetail.message ? (
            <p className={styles.detailMessage}>{jobDetail.message}</p>
          ) : null}
          <div className={styles.detailDevices}>
            {jobDetail.items.map((item) => (
              <div key={item.deviceId}>
                <strong>{item.deviceId}</strong>
                <span>{item.status} · intento{item.attempts === 1 ? "" : "s"} {item.attempts}</span>
                {item.lastError ? <small>{item.lastError}</small> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.activity}>
        <div className={styles.activityHeader}>
          <div>
            <span className={styles.liveDot} />
            <strong>Actividad de la sesión</strong>
          </div>
          <button type="button" onClick={() => setLogs([])} disabled={logs.length === 0}>Limpiar</button>
        </div>
        <div className={styles.logList} aria-live="polite">
          {logs.length ? logs.map((log) => (
            <div className={`${styles.logEntry} ${styles[`logEntry--${log.tone}`]}`} key={log.id}>
              <span>[{log.time}]</span>
              <p>{log.message}</p>
            </div>
          )) : <p className={styles.emptyLog}>No hay actividad registrada en esta sesión.</p>}
        </div>
      </section>
    </div>
  );
}

function DeviceRow({ device, checked, onToggle }: { device: Device; checked: boolean; onToggle: () => void }) {
  if (!device.found) {
    return (
      <tr className={styles.missingRow}>
        <td />
        <td>
          <strong>{device.device_id}</strong>
          <small>{device.error ?? "No registrado en el servidor MDM"}</small>
        </td>
        <td colSpan={3}>El dispositivo no está disponible para ejecutar acciones.</td>
        <td><span className={`${styles.deviceStatus} ${styles["deviceStatus--missing"]}`}>Inexistente</span></td>
      </tr>
    );
  }

  const locked = device.status?.toLowerCase() === "bloqueado";
  const permissionCount = Array.isArray(device.permissions)
    ? device.permissions.slice(0, 3).filter((permission) => permission === 1).length
    : null;

  return (
    <tr className={checked ? styles.selectedRow : undefined}>
      <td className={styles.checkColumn}>
        <SelectionCheckbox checked={checked} onChange={onToggle} label={`Seleccionar ${device.device_id}`} />
      </td>
      <td>
        <strong className={styles.deviceId}>{device.device_id}</strong>
        <small>IMEI: {device.imei || "N/A"}</small>
        {device.description ? <span className={styles.description}>{device.description}</span> : null}
      </td>
      <td>
        <strong>{device.configuration_name || device.config_name || "Sin configuración"}</strong>
        <small>{device.groups || device.group_name || "Sin grupo"}</small>
      </td>
      <td>
        <div className={styles.healthList}>
          <HealthPill tone={permissionCount === 3 ? "good" : permissionCount === null ? "neutral" : "bad"} label={permissionCount === null ? "Permisos —" : `Permisos ${permissionCount}/3`} />
          <HealthPill tone={statusTone(device.apps_status)} label={`Apps ${statusLabel(device.apps_status)}`} />
          <HealthPill tone={statusTone(device.files_status)} label={`Archivos ${statusLabel(device.files_status)}`} />
        </div>
      </td>
      <td><span className={styles.lastActive}>{device.last_active || "Sin datos"}</span></td>
      <td>
        <span className={`${styles.deviceStatus} ${locked ? styles["deviceStatus--locked"] : styles["deviceStatus--free"]}`}>
          <span />{locked ? "Bloqueado" : "Libre"}
        </span>
      </td>
    </tr>
  );
}

function SelectionCheckbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={styles.selectionCheckbox}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span><CheckIcon /></span>
    </label>
  );
}

function HealthPill({ tone, label }: { tone: string; label: string }) {
  return <span className={`${styles.healthPill} ${styles[`healthPill--${tone}`]}`}><i />{label}</span>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function AlertIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17.5v.5" /></svg>;
}

function UnlockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.6-1.7" /></svg>;
}
