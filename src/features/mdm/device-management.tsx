"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { CheckIcon, ChevronRightIcon, LockIcon, ShieldIcon } from "@/components/icons";
import {
  isTerminalMdmDeviceActionJob,
  mdmDeviceActionJobItemLabel,
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
  description?: string;
  lock_status?: "LOCKED" | "UNLOCKED" | "UNKNOWN";
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

type BranchToRestore = {
  id: number | null;
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

function formatJobDate(value: string) {
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function relativeJobTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Hace instantes";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.round(hours / 24)} d`;
}

function escapeSpreadsheetValue(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function spreadsheetRow(values: string[]) {
  return `<Row>${values
    .map(
      (value) =>
        `<Cell><Data ss:Type="String">${escapeSpreadsheetValue(value)}</Data></Cell>`,
    )
    .join("")}</Row>`;
}

function downloadActionJobSummary(job: MdmDeviceActionJobDetail) {
  const summaryRows = [
    ["Ejecución", job.id],
    ["Acción", job.action === "lock" ? "Bloqueo" : "Desbloqueo"],
    ["Estado", mdmDeviceActionJobLabel(job)],
    ["Sucursal", job.branchName || "Sin sucursal"],
    ["Fecha", formatJobDate(job.createdAt)],
    ["Total", String(job.total)],
    ["Completados", String(job.succeeded)],
    ["Fallidos", String(job.failed)],
  ]
    .map(spreadsheetRow)
    .join("");
  const itemRows = job.items
    .map((item) =>
      spreadsheetRow([
        item.deviceId,
        mdmDeviceActionJobItemLabel(item.status),
        String(item.attempts),
        item.lastError || "Sin error registrado",
      ]),
    )
    .join("");
  const spreadsheet = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Resumen y detalle"><Table>
    ${summaryRows}
    <Row></Row>
    ${spreadsheetRow(["IMEI / identificador", "Estado", "Intentos", "Último error"])}
    ${itemRows}
  </Table></Worksheet>
</Workbook>`;
  const blob = new Blob([spreadsheet], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `resumen-${job.action}-${job.id}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

const ACTIVE_ACTION_JOB_KEY = "teklease-active-mdm-device-action-job";

export function DeviceManagement() {
  const [input, setInput] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [branches, setBranches] = useState<MdmBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [branchToRestore, setBranchToRestore] = useState<BranchToRestore | null>(null);
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
  const [actionToConfirm, setActionToConfirm] = useState<"lock" | "unlock" | null>(null);
  const [jobToRerun, setJobToRerun] = useState<MdmDeviceActionJob | null>(null);
  const [jobDetail, setJobDetail] = useState<MdmDeviceActionJobDetail | null>(null);
  const [loadingDetailJobId, setLoadingDetailJobId] = useState("");
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isRetryingJob, setIsRetryingJob] = useState(false);
  const [maxSpecificDevices, setMaxSpecificDevices] = useState(1000);
  const [queryBatchSize, setQueryBatchSize] = useState(20);
  const idempotencyKeyRef = useRef("");
  const displayedDeviceIdentifiersRef = useRef<string[]>([]);
  const detailTriggerRef = useRef<HTMLButtonElement>(null);
  const historyBackButtonRef = useRef<HTMLButtonElement>(null);
  const historyCloseButtonRef = useRef<HTMLButtonElement>(null);
  const historyTriggerRef = useRef<HTMLButtonElement>(null);
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
  const notFoundDevices = devices.filter((device) => !device.found);
  const actionDevices = [...selectedDevices, ...notFoundDevices];
  const hasTargets = actionDevices.length > 0;
  const actionInProgress = Boolean(activeJob && !isTerminalMdmDeviceActionJob(activeJob));
  const restoredBranch = branchToRestore
    ? branches.find((branch) => branch.id === branchToRestore.id)
      ?? branches.find(
        (branch) => branch.name.trim().toLocaleLowerCase() === branchToRestore.name.trim().toLocaleLowerCase(),
      )
    : undefined;
  const selectedBranchValue = branchId || (restoredBranch ? String(restoredBranch.id) : "");
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
    const jobId = new URLSearchParams(window.location.search).get("editarEjecucion");
    if (!jobId) return;

    async function loadExecutionForEditing(id: string) {
      try {
        const response = await fetch(`/api/mdm/action-jobs/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ActionJobResponse;
        const detail = parseMdmDeviceActionJobDetail(data);
        if (!response.ok || data.status !== "success" || !detail) {
          throw new Error(responseMessage(data));
        }
        const identifiersToEdit = detail.items.map((item) => item.deviceId);
        setInput(identifiersToEdit.join("\n"));
        setMessage(detail.message);
        setSelectedTemplate(detail.message);
        setBranchToRestore({ id: detail.branchId, name: detail.branchName });
        setNotice("Revisá los dispositivos, la sucursal y el mensaje antes de ejecutar nuevamente.");
        await queryDevices(identifiersToEdit, true);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "No se pudo preparar la ejecución para editar.");
      }
    }

    void loadExecutionForEditing(jobId);
  }, []);

  useEffect(() => {
    if (jobDetail) historyBackButtonRef.current?.focus();
  }, [jobDetail]);

  useEffect(() => {
    if (!isHistoryDrawerOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setJobDetail(null);
      setIsHistoryDrawerOpen(false);
      window.setTimeout(() => historyTriggerRef.current?.focus(), 0);
    }

    historyCloseButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHistoryDrawerOpen]);

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
    displayedDeviceIdentifiersRef.current = devices.map((device) => device.device_id);
  }, [devices]);

  useEffect(() => {
    if (!activeJobId || activeJobTerminal) return;

    let closed = false;
    let reconnectDelay = 1_000;
    let reconnectTimer: number | undefined;
    let source: EventSource | undefined;

    function closeSource() {
      source?.close();
      source = undefined;
    }

    function handleProgress(event: MessageEvent<string>) {
      try {
        const data = JSON.parse(event.data) as ActionJobResponse;
        const job = parseMdmDeviceActionJob(data.job);
        if (!job) throw new Error("El progreso recibido está incompleto.");

        setActiveJob(job);
        if (isTerminalMdmDeviceActionJob(job)) {
          closed = true;
          closeSource();
          window.localStorage.removeItem(ACTIVE_ACTION_JOB_KEY);
          void loadJobHistory();
          if (job.succeeded > 0 && displayedDeviceIdentifiersRef.current.length > 0) {
            void queryDevices(displayedDeviceIdentifiersRef.current);
          }
        }
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el progreso de la acción.",
        );
      }
    }

    function connect() {
      if (closed) return;

      const nextSource = new EventSource(
        `/api/mdm/action-jobs/${encodeURIComponent(activeJobId)}/events`,
      );
      source = nextSource;
      nextSource.addEventListener("snapshot", handleProgress);
      nextSource.addEventListener("progress", handleProgress);
      nextSource.onopen = () => {
        reconnectDelay = 1_000;
      };
      nextSource.onerror = () => {
        nextSource.close();
        if (source === nextSource) source = undefined;
        if (closed) return;

        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
      };
    }

    connect();
    return () => {
      closed = true;
      closeSource();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [activeJobId, activeJobTerminal]);

  useEffect(() => {
    if (!activeJobId || activeJobTerminal) return;

    let cancelled = false;

    async function syncJobStatus() {
      try {
        const response = await fetch(`/api/mdm/action-jobs/${encodeURIComponent(activeJobId)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ActionJobResponse;
        const job = parseMdmDeviceActionJob(data.job);
        if (!response.ok || data.status !== "success" || !job || cancelled) return;

        setActiveJob(job);
        if (isTerminalMdmDeviceActionJob(job)) {
          window.localStorage.removeItem(ACTIVE_ACTION_JOB_KEY);
          void loadJobHistory();
        }
      } catch {
        // SSE sigue siendo el canal principal; el siguiente ciclo vuelve a consultar el estado durable.
      }
    }

    void syncJobStatus();
    const interval = window.setInterval(() => void syncJobStatus(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
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

  async function queryDevices(
    deviceIdentifiers = identifiers,
    selectFoundDevices = false,
  ) {
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
      setSelected(
        selectFoundDevices
          ? new Set(
              validResults
                .filter((device) => device.found)
                .map((device) => device.device_id),
            )
          : new Set(),
      );
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

  function handleClearForm() {
    setInput("");
    setDevices([]);
    setSelected(new Set());
    setFilter("");
    setMessage("");
    setSelectedTemplate("");
    setBranchId("");
    setNotice("");
    setActiveJobId("");
    setActiveJob(null);
    idempotencyKeyRef.current = "";
    window.localStorage.removeItem(ACTIVE_ACTION_JOB_KEY);
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
    setSelectedTemplate(value);
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
    if (action === "lock" && !selectedTemplate) {
      setNotice("Seleccioná una plantilla antes de bloquear dispositivos.");
      return;
    }
    const selectedBranchId = selectedBranchValue ? Number(selectedBranchValue) : undefined;
    const actionLabel = action === "lock" ? "bloquear" : "desbloquear";
    const targetLabel = `${actionDevices.length} identificador(es)`;
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
          devices: actionDevices.map((device) => ({
            number: device.device_id,
          })),
          action,
          message: action === "lock" ? message.trim() : "",
          ...(selectedBranchId === undefined ? {} : { branch_id: selectedBranchId }),
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
      if (action === "lock") {
        setMessage("");
        setSelectedTemplate("");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "No se pudo enviar el comando al MDM.";
      setNotice(errorMessage);
      addLog(errorMessage, "error");
    } finally {
      setPendingAction(null);
    }
  }

  function requestAction(action: "lock" | "unlock") {
    if (!hasTargets || actionInProgress) return;
    if (action === "lock" && !selectedTemplate) {
      setNotice("Seleccioná una plantilla antes de bloquear dispositivos.");
      return;
    }
    setActionToConfirm(action);
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

  function returnToHistory() {
    setJobDetail(null);
    window.setTimeout(() => detailTriggerRef.current?.focus(), 0);
  }

  function closeHistoryDrawer() {
    setJobDetail(null);
    setIsHistoryDrawerOpen(false);
    window.setTimeout(() => historyTriggerRef.current?.focus(), 0);
  }

  return (
    <div className={`${styles.page} workspace-page`}>
      <nav className={styles.breadcrumb} aria-label="Migas de pan">
        <Link href="/panel">Dashboard</Link>
        <ChevronRightIcon />
        <span>Lock / Unlock</span>
      </nav>

      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>Gestión MDM</span>
          <h1>Bloqueo y desbloqueo</h1>
          <p>Consultá el estado real de tus equipos y ejecutá acciones masivas de forma segura.</p>
        </div>
        <div className={styles.heroActions}>
          <div className={styles.securityNote}>
            <ShieldIcon />
            <span>
              <strong>Entorno protegido</strong>
              Acciones registradas y monitoreadas
            </span>
          </div>
        </div>
      </section>

      <div className={styles.contentLayout}>
        <main className={styles.mainColumn}>
      <section className={styles.queryCard}>
        <form onSubmit={handleQuery}>
          <div className={styles.queryHeading}>
            <div>
              <span className={styles.step}>1</span>
              <div>
                <h2>Elegí los dispositivos</h2>
                <p>Ingresá un IMEI o Device ID por línea y verificá cuáles existen en Headwind.</p>
              </div>
            </div>
            <div className={styles.queryTools}>
              <span className={styles.counter}>{identifiers.length} / {maxSpecificDevices}</span>
              <button
                className={styles.clearFormButton}
                type="button"
                onClick={handleClearForm}
                disabled={
                  isQuerying ||
                  pendingAction !== null ||
                  isSavingTemplate ||
                  isRetryingJob
                }
              >
                Limpiar formulario
              </button>
            </div>
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

        </main>

      {devices.length > 0 ? (
        <section className={styles.results}>
          <div className={styles.resultsHeading}>
            <div className={styles.resultsHeadingText}>
              <h2>Dispositivos verificados</h2>
              <p>Los no encontrados quedarán registrados en la ejecución, sin enviarse a Headwind.</p>
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
              <span className={styles.resultCount}>
                {foundDevices.length} encontrados
                {notFoundDevices.length > 0 ? ` · ${notFoundDevices.length} no encontrados` : ""}
              </span>
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
        </section>
      ) : null}

      <div className={styles.actionColumn}>
      {devices.length > 0 && hasTargets ? (
            <section className={styles.actionPanel}>
              <div className={styles.actionStepHeading}>
                <span className={styles.step}>2</span>
                <div>
                  <h2>Elegí la acción</h2>
                  <p>La sucursal es opcional. Para bloquear, elegí una plantilla.</p>
                </div>
              </div>
              <div className={styles.actionFields}>
                <label>
                  <span>Sucursal (opcional)</span>
                  <select
                    value={selectedBranchValue}
                    onChange={(event) => {
                      setBranchId(event.target.value);
                      setBranchToRestore(null);
                    }}
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
                    placeholder="Mensaje visible en el dispositivo"
                    maxLength={500}
                  />
                </label>
                <label>
                  <span>Plantilla (obligatoria para bloquear)</span>
                  <select
                    value={selectedTemplate}
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
                  onClick={() => requestAction("unlock")}
                  disabled={pendingAction !== null || actionInProgress}
                >
                  <UnlockIcon />
                  {pendingAction === "unlock"
                    ? "Desbloqueando…"
                    : selectedDevices.length > 0
                      ? "Desbloquear seleccionados"
                      : "Registrar no encontrados"}
                </button>
                <button
                  className={styles.lockButton}
                  type="button"
                  onClick={() => requestAction("lock")}
                  disabled={pendingAction !== null || actionInProgress || !selectedTemplate}
                >
                  <LockIcon />
                  {pendingAction === "lock"
                    ? "Bloqueando…"
                    : selectedDevices.length > 0
                      ? "Bloquear seleccionados"
                      : "Registrar no encontrados"}
                </button>
              </div>
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

      </div>

        <aside className={styles.historyPreview} aria-labelledby="action-history-heading">
          <div className={styles.historyPreviewHeading}>
            <div>
              <h2 id="action-history-heading">Últimas ejecuciones</h2>
              <span><i />Actualizado hace instantes</span>
            </div>
            <button type="button" onClick={() => void loadJobHistory()} disabled={isLoadingHistory} aria-label="Actualizar ejecuciones">
              ↻
            </button>
          </div>
          {isLoadingHistory ? (
            <p className={styles.historyEmpty}>Cargando ejecuciones…</p>
          ) : jobHistory.length === 0 ? (
            <p className={styles.historyEmpty}>Todavía no hay acciones registradas.</p>
          ) : (
            <div className={styles.historyPreviewList}>
              {jobHistory.slice(0, 4).map((job) => (
                <Link className={styles.historyPreviewItem} href={`/panel/dispositivos/historial?ejecucion=${encodeURIComponent(job.id)}`} key={job.id}>
                  <span className={`${styles.historyPreviewIcon} ${job.action === "lock" ? styles.historyPreviewIconLock : styles.historyPreviewIconUnlock}`}>
                    {job.action === "lock" ? <LockIcon /> : <UnlockIcon />}
                  </span>
                  <div className={styles.historyPreviewContent}>
                    <strong>{job.action === "lock" ? "Bloquear" : "Desbloquear"}</strong>
                    <span className={`${styles.historyPreviewStatus} ${job.status === "SUCCEEDED" ? "" : styles.historyPreviewStatusWarning}`}>
                      {job.status === "SUCCEEDED" ? <CheckIcon /> : "△"} {mdmDeviceActionJobLabel(job)}
                    </span>
                    <small>{relativeJobTime(job.createdAt)} · {job.total} equipo{job.total === 1 ? "" : "s"}</small>
                  </div>
                  <span className={styles.historyPreviewArrow}>›</span>
                </Link>
              ))}
            </div>
          )}
          <Link className={styles.historyPreviewLink} href="/panel/dispositivos/historial">
            Ver historial completo
          </Link>
        </aside>
      </div>

      {isHistoryDrawerOpen ? (
        <>
          <button
            className={styles.historyDrawerBackdrop}
            type="button"
            onClick={closeHistoryDrawer}
            aria-label="Cerrar historial de ejecuciones"
          />
          <aside
            className={`${styles.historyDrawer} ${
              jobDetail ? styles.historyDrawerDetail : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-action-history-heading"
          >
            <div className={styles.historyDrawerHeader}>
              <div>
                <span>{jobDetail ? "DETALLE DE EJECUCIÓN" : "HISTORIAL"}</span>
                <h2 id="all-action-history-heading">
                  {jobDetail
                    ? `${jobDetail.action === "lock" ? "Bloquear" : "Desbloquear"} · ${mdmDeviceActionJobLabel(jobDetail)}`
                    : "Todas las ejecuciones"}
                </h2>
                {jobDetail ? (
                  <small>{formatJobDate(jobDetail.createdAt)} · {jobDetail.branchName || "Sin sucursal"}</small>
                ) : null}
              </div>
              <button
                ref={historyCloseButtonRef}
                type="button"
                onClick={closeHistoryDrawer}
                aria-label="Cerrar historial"
              >
                Cerrar
              </button>
            </div>
            {jobDetail ? (
              <>
                <div className={styles.detailActions}>
                  <button
                    ref={historyBackButtonRef}
                    type="button"
                    onClick={returnToHistory}
                  >
                    ← Volver a ejecuciones
                  </button>
                  <button type="button" onClick={() => downloadActionJobSummary(jobDetail)}>
                    Descargar Excel
                  </button>
                </div>
                <section className={`${styles.jobProgress} ${styles.detailJobProgress}`}>
                  <div className={styles.jobProgressHeading}>
                    <div>
                      <span>{jobDetail.action === "lock" ? <LockIcon /> : <UnlockIcon />}</span>
                      <div>
                        <small>RESUMEN DE EJECUCIÓN</small>
                        <strong>{mdmDeviceActionJobLabel(jobDetail)}</strong>
                      </div>
                    </div>
                    <small>{jobDetail.id}</small>
                  </div>
                  <progress
                    max={Math.max(jobDetail.total, 1)}
                    value={Math.min(jobDetail.succeeded + jobDetail.failed, jobDetail.total)}
                  />
                  <div className={styles.jobStats}>
                    <div><span>Total</span><strong>{jobDetail.total}</strong></div>
                    <div><span>Pendientes</span><strong>{jobDetail.pending}</strong></div>
                    <div><span>Completados</span><strong>{jobDetail.succeeded}</strong></div>
                    <div><span>Fallidos</span><strong>{jobDetail.failed}</strong></div>
                  </div>
                </section>
                {jobDetail.action === "lock" && jobDetail.message ? (
                  <p className={styles.detailMessage}>{jobDetail.message}</p>
                ) : null}
                <div className={styles.detailDevices}>
                  {jobDetail.items.map((item) => (
                    <div key={item.deviceId}>
                      <strong>{item.deviceId}</strong>
                      <span>
                        {mdmDeviceActionJobItemLabel(item.status)} · intento{item.attempts === 1 ? "" : "s"} {item.attempts}
                      </span>
                      {item.lastError ? <small>{item.lastError}</small> : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  className={styles.historyRefreshButton}
                  type="button"
                  onClick={() => void loadJobHistory()}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "Actualizando…" : "Actualizar historial"}
                </button>
                {isLoadingHistory ? (
                  <p className={styles.historyEmpty}>Cargando ejecuciones…</p>
                ) : jobHistory.length === 0 ? (
                  <p className={styles.historyEmpty}>Todavía no hay acciones registradas.</p>
                ) : (
                  <div className={styles.historyDrawerList}>
                    {jobHistory.map((job) => (
                      <article className={styles.historyDrawerItem} key={job.id}>
                        <div>
                          <strong>{job.action === "lock" ? "Bloquear" : "Desbloquear"} · {mdmDeviceActionJobLabel(job)}</strong>
                          <small>{formatJobDate(job.createdAt)} · {job.branchName || "Sin sucursal"}</small>
                        </div>
                        <dl>
                          <div><dt>Equipos</dt><dd>{job.total}</dd></div>
                          <div><dt>Completados</dt><dd>{job.succeeded}</dd></div>
                          <div><dt>Fallidos</dt><dd>{job.failed}</dd></div>
                        </dl>
                        <div className={styles.historyDrawerActions}>
                          <button
                            type="button"
                            onClick={(event) => {
                              detailTriggerRef.current = event.currentTarget;
                              void handleViewDetail(job);
                            }}
                            disabled={Boolean(loadingDetailJobId)}
                          >
                            {loadingDetailJobId === job.id ? "Abriendo…" : "Ver detalle"}
                          </button>
                          {isTerminalMdmDeviceActionJob(job) ? (
                            <button
                              type="button"
                              onClick={() => setJobToRerun(job)}
                              disabled={Boolean(rerunningJobId)}
                            >
                              {rerunningJobId === job.id ? "Reejecutando…" : "Reejecutar"}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </aside>
        </>
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
      <ConfirmationDialog
        isOpen={actionToConfirm !== null}
        title={actionToConfirm === "lock" ? "¿Bloquear dispositivos?" : "¿Desbloquear dispositivos?"}
        description={actionToConfirm ? `Se enviará la orden para ${actionDevices.length} identificador${actionDevices.length === 1 ? "" : "es"}.` : ""}
        confirmLabel={actionToConfirm === "lock" ? "Bloquear" : "Desbloquear"}
        onCancel={() => setActionToConfirm(null)}
        onConfirm={() => {
          if (!actionToConfirm) return;
          const action = actionToConfirm;
          setActionToConfirm(null);
          void triggerAction(action);
        }}
      />
      <ConfirmationDialog
        isOpen={jobToRerun !== null}
        title="¿Reejecutar esta acción?"
        description={jobToRerun ? `Se volverá a ${jobToRerun.action === "lock" ? "bloquear" : "desbloquear"} los ${jobToRerun.total} dispositivo${jobToRerun.total === 1 ? "" : "s"} de esta ejecución.` : ""}
        confirmLabel="Reejecutar"
        onCancel={() => setJobToRerun(null)}
        onConfirm={() => {
          if (!jobToRerun) return;
          const job = jobToRerun;
          setJobToRerun(null);
          void handleRerun(job);
        }}
      />
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
        <td colSpan={1}>El dispositivo no está disponible para ejecutar acciones.</td>
        <td><span className={`${styles.deviceStatus} ${styles["deviceStatus--missing"]}`}>Inexistente</span></td>
      </tr>
    );
  }

  const lockStatus = device.lock_status ?? "UNKNOWN";
  const lockStatusLabel = {
    LOCKED: "Bloqueado",
    UNLOCKED: "Desbloqueado",
    UNKNOWN: "Sin información",
  }[lockStatus];

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
        <span className={`${styles.deviceStatus} ${styles[`deviceStatus--${lockStatus.toLowerCase()}`]}`}>
          <span />{lockStatusLabel}
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

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function AlertIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17.5v.5" /></svg>;
}

function UnlockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.6-1.7" /></svg>;
}
