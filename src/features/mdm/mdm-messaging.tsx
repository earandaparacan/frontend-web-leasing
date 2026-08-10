"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  DeviceIcon,
  MessageIcon,
  ShieldIcon,
} from "@/components/icons";
import styles from "./mdm-messaging.module.css";
import {
  isTerminalMessageJob,
  messageJobItemStatusLabel,
  messageJobStatusLabel,
  parseMessageJob,
  parseMessageJobDetail,
  type MessageJob,
  type MessageJobDetail,
} from "./mdm-message-job";

const ACTIVE_MESSAGE_JOB_KEY = "teklease-active-mdm-message-job";

type Device = {
  device_id: string;
  imei?: string;
  description?: string;
  configuration_name?: string;
  groups?: string;
  found: boolean;
  error?: string;
};

type DeviceGroup = {
  id: number;
  name: string;
};

type MdmBranch = {
  id: number;
  name: string;
};

type MdmCapabilities = {
  max_specific_devices: number;
  query_batch_size: number;
  query_concurrency: number;
  max_message_length: number;
  max_identifier_length: number;
  max_import_bytes: number;
};

type ApiResponse = {
  status?: string;
  message?: string;
  error?: string;
  results?: unknown;
  groups?: unknown;
  branches?: unknown;
  templates?: unknown;
  template?: unknown;
  job?: unknown;
  jobs?: unknown;
  capabilities?: unknown;
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

function responseMessage(data: ApiResponse) {
  return data.message ?? data.error ?? "No se pudo completar la operación.";
}

function isDevice(value: unknown): value is Device {
  if (typeof value !== "object" || value === null) return false;
  const device = value as Record<string, unknown>;
  return typeof device.device_id === "string" && typeof device.found === "boolean";
}

function isDeviceGroup(value: unknown): value is DeviceGroup {
  if (typeof value !== "object" || value === null) return false;
  const group = value as Record<string, unknown>;
  return (
    typeof group.id === "number" &&
    Number.isSafeInteger(group.id) &&
    group.id > 0 &&
    typeof group.name === "string" &&
    group.name.trim().length > 0
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isMdmCapabilities(value: unknown): value is MdmCapabilities {
  if (typeof value !== "object" || value === null) return false;
  const capabilities = value as Record<string, unknown>;
  return (
    isPositiveInteger(capabilities.max_specific_devices) &&
    isPositiveInteger(capabilities.query_batch_size) &&
    isPositiveInteger(capabilities.query_concurrency) &&
    isPositiveInteger(capabilities.max_message_length) &&
    isPositiveInteger(capabilities.max_identifier_length) &&
    isPositiveInteger(capabilities.max_import_bytes)
  );
}

function parseIdentifiers(value: string) {
  return [...new Set(value.split(/[\r\n,;\t]+/).map((item) => item.trim()).filter(Boolean))];
}

function deviceBatches(identifiers: string[], batchSize: number) {
  const batches: string[][] = [];
  for (let index = 0; index < identifiers.length; index += batchSize) {
    batches.push(identifiers.slice(index, index + batchSize));
  }
  return batches;
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
  return `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeSpreadsheetValue(value)}</Data></Cell>`).join("")}</Row>`;
}

function downloadJobSummary(job: MessageJobDetail) {
  const summaryRows = [
    ["Ejecución", job.id],
    ["Estado", messageJobStatusLabel(job.status)],
    ["Sucursal", job.branchName || "Sin sucursal"],
    ["Fecha", formatJobDate(job.createdAt)],
    ["Total", String(job.total)],
    ["Aceptados", String(job.accepted)],
    ["Fallidos", String(job.failed)],
  ].map(spreadsheetRow).join("");
  const itemRows = job.items
    .map((item) => spreadsheetRow([
      item.deviceId,
      messageJobItemStatusLabel(item.status),
      String(item.attempts),
      item.lastError || "Sin error registrado",
    ]))
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
  const blob = new Blob([spreadsheet], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `resumen-ejecucion-${job.id}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

export function MdmMessaging() {
  const [targetMode, setTargetMode] = useState<"devices" | "group" | "all">("devices");
  const [input, setInput] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [branches, setBranches] = useState<MdmBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [capabilities, setCapabilities] = useState<MdmCapabilities | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRetryingJob, setIsRetryingJob] = useState(false);
  const [activeJob, setActiveJob] = useState<MessageJob | null>(null);
  const [jobHistory, setJobHistory] = useState<MessageJob[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [rerunningJobId, setRerunningJobId] = useState("");
  const [jobDetail, setJobDetail] = useState<MessageJobDetail | null>(null);
  const [loadingDetailJobId, setLoadingDetailJobId] = useState("");
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "initial",
      time: "Sistema",
      message: "Panel listo para enviar mensajes.",
      tone: "info",
    },
  ]);
  const jobRequestRef = useRef<{ signature: string; key: string } | null>(null);
  const detailTriggerRef = useRef<HTMLButtonElement>(null);
  const historyBackButtonRef = useRef<HTMLButtonElement>(null);
  const historyCloseButtonRef = useRef<HTMLButtonElement>(null);
  const historyTriggerRef = useRef<HTMLButtonElement>(null);

  const identifiers = useMemo(() => parseIdentifiers(input), [input]);
  const foundDevices = devices.filter((device) => device.found);
  const visibleDevices = devices.filter((device) => {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return [device.device_id, device.imei, device.description, device.configuration_name, device.groups]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(term));
  });
  const selectedDevices = devices.filter(
    (device) => device.found && selected.has(device.device_id),
  );
  const missingDevices = devices.filter((device) => !device.found);
  const devicesForJob = [...selectedDevices, ...missingDevices].map(
    (device) => device.device_id,
  );
  const selectedGroup = groups.find((group) => group.id === Number(selectedGroupId));
  const canComposeMessage =
    targetMode === "devices"
      ? selectedDevices.length > 0
      : targetMode === "group"
        ? Boolean(selectedGroup)
        : true;
  const allVisibleDevicesSelected =
    visibleDevices.some((device) => device.found) &&
    visibleDevices.filter((device) => device.found).every((device) => selected.has(device.device_id));

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

  async function loadJobHistory() {
    try {
      const response = await fetch("/api/mdm/message-jobs", {
        cache: "no-store",
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.status !== "success" || !Array.isArray(data.jobs)) {
        throw new Error(responseMessage(data));
      }
      const parsedJobs = data.jobs.map(parseMessageJob);
      if (parsedJobs.some((job) => job === null)) {
        throw new Error("El historial de envíos contiene datos incompletos.");
      }
      setJobHistory(
        parsedJobs.filter((job): job is MessageJob => job !== null),
      );
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo cargar el historial.",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadTemplates() {
      try {
        const response = await fetch("/api/mdm/message-templates", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as ApiResponse;
        if (
          !response.ok ||
          data.status !== "success" ||
          !Array.isArray(data.templates) ||
          !data.templates.every((template) => typeof template === "string")
        ) {
          throw new Error(responseMessage(data));
        }
        setTemplates(data.templates);
      } catch (error) {
        if (controller.signal.aborted) return;
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "No se pudieron cargar las plantillas.",
        });
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

    async function loadExecutionForEditing() {
      try {
        const response = await fetch(`/api/mdm/message-jobs/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ApiResponse;
        const detail = parseMessageJobDetail(data);
        if (!response.ok || data.status !== "success" || !detail) {
          throw new Error(responseMessage(data));
        }
        setTargetMode("devices");
        handleIdentifierChange(detail.items.map((item) => item.deviceId).join("\n"));
        setMessage(detail.message);
        setSelectedTemplate(detail.message);
        setNotice({
          tone: "success",
          text: "La ejecución fue cargada. Verificá los dispositivos, la sucursal y el mensaje antes de enviar.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "No se pudo preparar el envío para editar.",
        });
      }
    }

    void loadExecutionForEditing();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBranches() {
      try {
        const response = await fetch("/api/mdm/branches", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as ApiResponse;
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
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "No se pudieron cargar las sucursales.",
        });
      } finally {
        if (!controller.signal.aborted) setIsLoadingBranches(false);
      }
    }

    void loadBranches();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCapabilities() {
      try {
        const response = await fetch("/api/mdm/capabilities", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as ApiResponse;
        if (
          !response.ok ||
          data.status !== "success" ||
          !isMdmCapabilities(data.capabilities)
        ) {
          throw new Error(responseMessage(data));
        }
        setCapabilities(data.capabilities);
      } catch (error) {
        if (controller.signal.aborted) return;
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "No se pudo cargar la configuración MDM.",
        });
      }
    }

    void loadCapabilities();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let restoreTimeout: number | undefined;
    try {
      const savedJob = window.localStorage.getItem(ACTIVE_MESSAGE_JOB_KEY);
      if (!savedJob) return undefined;
      const job = parseMessageJob(JSON.parse(savedJob));
      if (job) restoreTimeout = window.setTimeout(() => setActiveJob(job), 0);
    } catch {
      window.localStorage.removeItem(ACTIVE_MESSAGE_JOB_KEY);
    }

    return () => {
      if (restoreTimeout !== undefined) window.clearTimeout(restoreTimeout);
    };
  }, []);

  useEffect(() => {
    if (activeJob) {
      window.localStorage.setItem(ACTIVE_MESSAGE_JOB_KEY, JSON.stringify(activeJob));
    }
  }, [activeJob]);

  useEffect(() => {
    if (jobDetail) historyBackButtonRef.current?.focus();
  }, [jobDetail]);

  useEffect(() => {
    if (!isHistoryDrawerOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsHistoryDrawerOpen(false);
      window.setTimeout(() => historyTriggerRef.current?.focus(), 0);
    }

    historyCloseButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHistoryDrawerOpen]);

  useEffect(() => {
    if (!activeJob || isTerminalMessageJob(activeJob)) return;

    const jobId = activeJob.id;
    const controller = new AbortController();
    let stopped = false;
    let timeout: number;

    async function pollJob() {
      let continuePolling = true;
      try {
        const response = await fetch(`/api/mdm/message-jobs/${encodeURIComponent(jobId)}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as ApiResponse;
        const job = parseMessageJob(data);
        if (!response.ok || data.status !== "success" || !job) {
          throw new Error(responseMessage(data));
        }

        setActiveJob(job);
        void loadJobHistory();
        if (job.status === "SUCCEEDED") {
          continuePolling = false;
          setNotice({ tone: "success", text: "Headwind aceptó todos los mensajes del envío." });
          addLog(`Envío ${job.id} aceptado por Headwind.`, "success");
        } else if (isTerminalMessageJob(job)) {
          continuePolling = false;
          const errorMessage = `El envío terminó con ${job.failed} dispositivo${job.failed === 1 ? "" : "s"} fallido${job.failed === 1 ? "" : "s"}.`;
          setNotice({
            tone: "error",
            text: errorMessage,
          });
          addLog(errorMessage, "error");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const errorMessage = error instanceof Error ? error.message : "No se pudo actualizar el progreso.";
        setNotice({
          tone: "error",
          text: errorMessage,
        });
        addLog(errorMessage, "error");
      } finally {
        if (!stopped && continuePolling) timeout = window.setTimeout(pollJob, 2_000);
      }
    }

    timeout = window.setTimeout(pollJob, 2_000);

    return () => {
      stopped = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activeJob]);

  function handleIdentifierChange(value: string) {
    setInput(value);
    setNotice(null);
    setDevices([]);
    setSelected(new Set());
    setFilter("");
  }

  function handleClearForm() {
    setTargetMode("devices");
    setInput("");
    setDevices([]);
    setSelected(new Set());
    setSelectedGroupId("");
    setBranchId("");
    setMessage("");
    setSelectedTemplate("");
    setActiveJob(null);
    setNotice(null);
    setFilter("");
    jobRequestRef.current = null;
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!capabilities) {
      setNotice({ tone: "error", text: "La configuración MDM todavía está cargando." });
      return;
    }
    if (
      identifiers.length === 0 ||
      identifiers.length > capabilities.max_specific_devices ||
      identifiers.some(
        (identifier) => identifier.length > capabilities.max_identifier_length,
      )
    ) {
      setNotice({
        tone: "error",
        text: `Ingresá entre 1 y ${capabilities.max_specific_devices} Device IDs o IMEIs válidos.`,
      });
      return;
    }

    setIsVerifying(true);
    setNotice(null);
    setDevices([]);
    setSelected(new Set());
    addLog(`Verificando ${identifiers.length} dispositivo(s)…`);

    try {
      const verifiedDevices: Device[] = [];
      const batches = deviceBatches(identifiers, capabilities.query_batch_size);

      for (
        let offset = 0;
        offset < batches.length;
        offset += capabilities.query_concurrency
      ) {
        const batchResults = await Promise.all(
          batches
            .slice(offset, offset + capabilities.query_concurrency)
            .map(async (batch) => {
            const response = await fetch("/api/mdm/devices/query", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ devices: batch }),
            });
            const data = (await response.json()) as ApiResponse;
            if (!response.ok || data.status !== "success") {
              throw new Error(responseMessage(data));
            }
            if (!Array.isArray(data.results) || !data.results.every(isDevice)) {
              throw new Error("Headwind MDM devolvió datos incompletos.");
            }
            return data.results;
          }),
        );
        verifiedDevices.push(...batchResults.flat());
      }

      setDevices(verifiedDevices);
      setSelected(new Set());
      setFilter("");
      const found = verifiedDevices.filter((device) => device.found).length;
      addLog(
        `Verificación completada: ${found} encontrado(s) y ${verifiedDevices.length - found} sin registro.`,
        "success",
      );
      setNotice(
        verifiedDevices.every((device) => !device.found)
          ? { tone: "error", text: "No encontramos ningún dispositivo registrado." }
          : null,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo verificar el dispositivo.";
      setNotice({
        tone: "error",
        text: errorMessage,
      });
      addLog(errorMessage, "error");
    } finally {
      setIsVerifying(false);
    }
  }

  function toggleDevice(deviceId: string) {
    setNotice(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  }

  async function handleGroupMode() {
    setTargetMode("group");
    setNotice(null);
    if (groups.length > 0 || isLoadingGroups) return;

    setIsLoadingGroups(true);
    try {
      const response = await fetch("/api/mdm/groups", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.status !== "success" || !Array.isArray(data.groups)) {
        throw new Error(responseMessage(data));
      }
      const availableGroups = data.groups.filter(isDeviceGroup);
      if (availableGroups.length !== data.groups.length) {
        throw new Error("Headwind MDM devolvió grupos incompletos.");
      }
      setGroups(availableGroups);
      if (availableGroups.length === 0) {
        setNotice({ tone: "error", text: "No hay grupos disponibles para este usuario." });
      }
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudieron cargar los grupos.",
      });
    } finally {
      setIsLoadingGroups(false);
    }
  }

  function handleTemplateChange(value: string) {
    setSelectedTemplate(value);
    if (!value) return;
    setMessage(value);
    setNotice(null);
  }

  async function handleSaveTemplate() {
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      setNotice({
        tone: "error",
        text: "Escribí un mensaje antes de guardarlo como plantilla.",
      });
      return;
    }
    if (templates.includes(cleanMessage)) {
      setNotice({
        tone: "error",
        text: "Ese mensaje ya está guardado como plantilla.",
      });
      return;
    }

    setIsSavingTemplate(true);
    setNotice(null);
    try {
      const response = await fetch("/api/mdm/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cleanMessage }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.status !== "success" || typeof data.template !== "string") {
        throw new Error(responseMessage(data));
      }
      const savedTemplate = data.template;
      setTemplates((current) =>
        current.includes(savedTemplate) ? current : [...current, savedTemplate],
      );
      setNotice({ tone: "success", text: "Plantilla guardada en el servidor." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la plantilla.",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanMessage = message.trim();
    const selectedBranchId = Number(branchId);

    if (!capabilities) {
      setNotice({ tone: "error", text: "La configuración MDM todavía está cargando." });
      return;
    }
    if (!Number.isSafeInteger(selectedBranchId) || selectedBranchId <= 0) {
      setNotice({ tone: "error", text: "Seleccioná una sucursal antes de enviar." });
      return;
    }

    if (targetMode === "devices" && selectedDevices.length === 0) {
      setNotice({ tone: "error", text: "Seleccioná al menos un dispositivo antes de enviar." });
      return;
    }
    if (targetMode === "group" && !selectedGroup) {
      setNotice({ tone: "error", text: "Seleccioná un grupo antes de enviar." });
      return;
    }
    if (!cleanMessage || cleanMessage.length > capabilities.max_message_length) {
      setNotice({
        tone: "error",
        text: `El mensaje debe contener entre 1 y ${capabilities.max_message_length} caracteres.`,
      });
      return;
    }
    if (
      targetMode === "all" &&
      !window.confirm(
        "¿Confirmás el envío de este mensaje a todos los dispositivos registrados?",
      )
    ) {
      return;
    }
    if (
      targetMode === "group" &&
      selectedGroup &&
      !window.confirm(`¿Confirmás el envío al grupo “${selectedGroup.name}”?`)
    ) {
      return;
    }
    if (
      targetMode === "devices" &&
      !window.confirm(
        `¿Confirmás el envío en segundo plano a ${devicesForJob.length} identificadores${
          missingDevices.length > 0
            ? `? ${missingDevices.length} se registrará${missingDevices.length === 1 ? "" : "n"} como no encontrado${missingDevices.length === 1 ? "" : "s"} sin enviarlo${missingDevices.length === 1 ? "" : "s"} a Headwind.`
            : "?"
        }`,
      )
    ) {
      return;
    }

    setIsSending(true);
    setNotice(null);
    const targetLabel =
      targetMode === "devices"
        ? `${devicesForJob.length} identificador(es)`
        : targetMode === "group"
          ? `el grupo ${selectedGroup?.name ?? "seleccionado"}`
          : "todos los dispositivos";
    addLog(`Solicitando envío a ${targetLabel}…`);

    try {
      if (targetMode === "devices") {
        const signature = `${cleanMessage}\u0000${devicesForJob.join("\u0000")}`;
        if (jobRequestRef.current?.signature !== signature) {
          jobRequestRef.current = { signature, key: crypto.randomUUID() };
        }

        const response = await fetch("/api/mdm/message-jobs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": jobRequestRef.current.key,
          },
          body: JSON.stringify({
            devices: devicesForJob,
            message: cleanMessage,
            branch_id: selectedBranchId,
          }),
        });
        const data = (await response.json()) as ApiResponse;
        const job = parseMessageJob(data);
        if (!response.ok || data.status !== "success" || !job) {
          throw new Error(responseMessage(data));
        }

        setActiveJob(job);
        void loadJobHistory();
        jobRequestRef.current = null;
        setMessage("");
        setSelectedTemplate("");
        setNotice({
          tone: "success",
          text: `Envío ${job.id} creado. Podés seguir el progreso sin mantener esta solicitud abierta.`,
        });
        addLog(`Envío ${job.id} creado para ${targetLabel}.`, "success");
        return;
      }

      const response = await fetch("/api/mdm/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          targetMode === "all"
            ? { scope: "all", message: cleanMessage, branch_id: selectedBranchId }
            : {
                scope: "group",
                group_id: selectedGroup?.id,
                message: cleanMessage,
                branch_id: selectedBranchId,
              },
        ),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.status !== "success") {
        throw new Error(responseMessage(data));
      }
      setMessage("");
      setSelectedTemplate("");
      setNotice({
        tone: "success",
        text: "Mensaje aceptado por Headwind.",
      });
      addLog(`Mensaje aceptado por Headwind para ${targetLabel}.`, "success");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo enviar el mensaje.";
      setNotice({
        tone: "error",
        text: errorMessage,
      });
      addLog(errorMessage, "error");
    } finally {
      setIsSending(false);
    }
  }

  async function handleRetryFailures() {
    if (!activeJob || activeJob.failed === 0) return;

    setIsRetryingJob(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/mdm/message-jobs/${encodeURIComponent(activeJob.id)}/retry-failures`,
        { method: "POST" },
      );
      const data = (await response.json()) as ApiResponse;
      const job = parseMessageJob(data);
      if (!response.ok || data.status !== "success" || !job) {
        throw new Error(responseMessage(data));
      }
      setActiveJob(job);
      void loadJobHistory();
      setNotice({ tone: "success", text: "Los errores transitorios volvieron a la cola." });
      addLog(`Reintentando ${job.pending} dispositivo(s) fallido(s).`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudieron reintentar los fallidos.";
      setNotice({
        tone: "error",
        text: errorMessage,
      });
      addLog(errorMessage, "error");
    } finally {
      setIsRetryingJob(false);
    }
  }

  function toggleVisibleDevices() {
    setNotice(null);
    setSelected((current) => {
      const next = new Set(current);
      visibleDevices.forEach((device) => {
        if (!device.found) return;
        if (allVisibleDevicesSelected) next.delete(device.device_id);
        else next.add(device.device_id);
      });
      return next;
    });
  }

  async function handleRerun(job: MessageJob) {
    if (!isTerminalMessageJob(job) || rerunningJobId) return;
    if (!window.confirm("¿Volvés a ejecutar este envío con los mismos dispositivos?")) {
      return;
    }

    setRerunningJobId(job.id);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/mdm/message-jobs/${encodeURIComponent(job.id)}/rerun`,
        { method: "POST" },
      );
      const data = (await response.json()) as ApiResponse;
      const rerun = parseMessageJob(data);
      if (!response.ok || data.status !== "success" || !rerun) {
        throw new Error(responseMessage(data));
      }
      setActiveJob(rerun);
      setJobHistory((current) => [rerun, ...current]);
      setNotice({ tone: "success", text: "El envío volvió a quedar en cola." });
      addLog(`El envío ${rerun.id} volvió a quedar en cola.`, "success");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo volver a ejecutar el envío.";
      setNotice({
        tone: "error",
        text: errorMessage,
      });
      addLog(errorMessage, "error");
    } finally {
      setRerunningJobId("");
    }
  }

  async function handleViewDetail(job: MessageJob) {
    setLoadingDetailJobId(job.id);
    try {
      const response = await fetch(
        `/api/mdm/message-jobs/${encodeURIComponent(job.id)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as ApiResponse;
      const detail = parseMessageJobDetail(data);
      if (!response.ok || data.status !== "success" || !detail) {
        throw new Error(responseMessage(data));
      }
      setJobDetail(detail);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo cargar el detalle del envío.",
      });
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
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Migas de pan">
        <Link href="/panel">Dashboard</Link>
        <ChevronRightIcon />
        <span>Mensajería MDM</span>
      </nav>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>HEADWIND MDM</span>
          <h1>Mensajería</h1>
          <p>
            Enviá avisos a varios dispositivos registrados. La web nunca accede a las
            credenciales administrativas del MDM.
          </p>
        </div>
        <div className={styles.headerIcon}><MessageIcon /></div>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.card} aria-labelledby="message-heading">
          <div className={styles.cardHeader}>
            <div>
              <span>NUEVO MENSAJE</span>
              <h2 id="message-heading">Preparar envío</h2>
            </div>
            <div className={styles.cardHeaderActions}>
              <button
                className={styles.clearFormButton}
                type="button"
                onClick={handleClearForm}
                disabled={isVerifying || isSending || isSavingTemplate || isRetryingJob}
              >
                Limpiar formulario
              </button>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.stepHeading}>
              <span>1</span>
              <div>
                <strong>Elegí el alcance</strong>
                <small>Enviá a equipos específicos o a toda la flota.</small>
              </div>
            </div>

            <div className={styles.targetModes} aria-label="Alcance del mensaje">
              <button
                type="button"
                aria-pressed={targetMode === "devices"}
                onClick={() => {
                  setTargetMode("devices");
                  setNotice(null);
                }}
                disabled={isSending}
              >
                Dispositivos específicos
              </button>
              <button
                type="button"
                aria-pressed={targetMode === "group"}
                onClick={() => void handleGroupMode()}
                disabled={isSending}
              >
                Por grupo
              </button>
              <button
                type="button"
                aria-pressed={targetMode === "all"}
                onClick={() => {
                  setTargetMode("all");
                  setNotice(null);
                }}
                disabled={isSending}
              >
                Todos los dispositivos
              </button>
            </div>

            {targetMode === "devices" ? (
              <>
                <form className={styles.deviceSearch} onSubmit={handleVerify}>
                  <label>
                    <span className="sr-only">Device IDs o IMEIs</span>
                    <DeviceIcon />
                    <textarea
                      value={input}
                      onChange={(event) => handleIdentifierChange(event.target.value)}
                      placeholder={"TKL-3019\n356938035643809"}
                      autoComplete="off"
                      rows={8}
                      disabled={isVerifying || isSending}
                    />
                    <small>
                      {identifiers.length} / {capabilities?.max_specific_devices ?? "…"}
                    </small>
                  </label>
                  <button
                    type="submit"
                    disabled={
                      isVerifying || isSending || identifiers.length === 0 || !capabilities
                    }
                  >
                    {isVerifying ? <span className={styles.spinner} /> : "Verificar"}
                  </button>
                </form>

                <p className={styles.identifierHint}>Un identificador por línea, o separados por coma.</p>

              </>
            ) : targetMode === "all" ? (
              <div className={styles.broadcastNotice}>
                <ShieldIcon />
                <p>
                  <strong>Envío masivo nativo</strong>
                  <span>Headwind distribuirá el mensaje a toda la flota en una sola operación, sin cargar los 3.000 IDs.</span>
                </p>
              </div>
            ) : (
              <div className={styles.groupTarget}>
                <label>
                  <span>Grupo de dispositivos</span>
                  <select
                    value={selectedGroupId}
                    onChange={(event) => {
                      setSelectedGroupId(event.target.value);
                      setNotice(null);
                    }}
                    disabled={isLoadingGroups || isSending}
                  >
                    <option value="">
                      {isLoadingGroups ? "Cargando grupos…" : "Seleccionar grupo"}
                    </option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <small>
                  Headwind enviará el aviso a todos los dispositivos pertenecientes al grupo.
                </small>
              </div>
            )}

          </div>
          </section>

          {devices.length > 0 ? (
            <section className={styles.results} aria-labelledby="verified-devices-heading">
              <div className={styles.resultsHeading}>
                <div>
                  <h2 id="verified-devices-heading">Dispositivos verificados</h2>
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
                    {foundDevices.length} encontrado{foundDevices.length === 1 ? "" : "s"}
                    {missingDevices.length > 0
                      ? ` · ${missingDevices.length} no encontrado${missingDevices.length === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th className={styles.checkColumn}>
                        <label className={styles.selectionCheckbox}>
                          <input
                            type="checkbox"
                            checked={allVisibleDevicesSelected}
                            onChange={toggleVisibleDevices}
                            disabled={isSending || !visibleDevices.some((device) => device.found)}
                            aria-label="Seleccionar dispositivos visibles"
                          />
                          <span><CheckIcon /></span>
                        </label>
                      </th>
                      <th>Equipo</th>
                      <th>Asignación</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDevices.map((device) =>
                      device.found ? (
                        <tr
                          className={selected.has(device.device_id) ? styles.selectedRow : undefined}
                          key={device.device_id}
                        >
                          <td className={styles.checkColumn}>
                            <label className={styles.selectionCheckbox}>
                              <input
                                type="checkbox"
                                checked={selected.has(device.device_id)}
                                onChange={() => toggleDevice(device.device_id)}
                                disabled={isSending}
                                aria-label={`Seleccionar ${device.device_id}`}
                              />
                              <span><CheckIcon /></span>
                            </label>
                          </td>
                          <td>
                            <strong>{device.device_id}</strong>
                            <small>IMEI: {device.imei || "Sin datos"}</small>
                            {device.description ? <span>{device.description}</span> : null}
                          </td>
                          <td>
                            <strong>{device.configuration_name || "Sin asignación"}</strong>
                            <small>{device.groups || "Sin grupo"}</small>
                          </td>
                          <td>
                            <span className={styles.deviceStatus}>Disponible</span>
                          </td>
                        </tr>
                      ) : (
                        <tr className={styles.missingRow} key={device.device_id}>
                          <td className={styles.checkColumn} />
                          <td>
                            <strong>{device.device_id}</strong>
                            <small>{device.error || "No registrado en el servidor MDM"}</small>
                          </td>
                          <td>El dispositivo no está disponible para recibir mensajes.</td>
                          <td><span className={`${styles.deviceStatus} ${styles.missingStatus}`}>No encontrado</span></td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
                {visibleDevices.length === 0 ? (
                  <p className={styles.emptyResults}>No hay resultados que coincidan con el filtro.</p>
                ) : null}
              </div>

              <div className={styles.selectionSummary}>
                <span>
                  {selectedDevices.length} dispositivo{selectedDevices.length === 1 ? "" : "s"} seleccionado{selectedDevices.length === 1 ? "" : "s"}
                </span>
                <button type="button" onClick={() => setSelected(new Set())} disabled={isSending || selectedDevices.length === 0}>
                  Quitar selección
                </button>
              </div>
            </section>
          ) : null}

          {canComposeMessage ? (
          <section className={`${styles.card} ${styles.messageCard}`} aria-labelledby="message-content-heading">
            <form className={styles.messageForm} onSubmit={handleSend}>
              <div className={styles.stepHeading}>
                <span>2</span>
                <div>
                  <strong id="message-content-heading">Escribí el mensaje</strong>
                  <small>
                    {targetMode === "all"
                      ? "El aviso se enviará a toda la flota registrada."
                      : targetMode === "group"
                        ? "El aviso se enviará a todos los equipos del grupo elegido."
                        : "El aviso aparecerá en todos los dispositivos seleccionados."}
                  </small>
                </div>
              </div>

              <div className={styles.branchField}>
                <label>
                  <span>Sucursal</span>
                  <select
                    value={branchId}
                    onChange={(event) => {
                      setBranchId(event.target.value);
                      setNotice(null);
                    }}
                    disabled={isLoadingBranches || isSending}
                  >
                    <option value="">
                      {isLoadingBranches ? "Cargando sucursales…" : "Seleccionar sucursal"}
                    </option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </label>
                <small>La sucursal queda registrada en la ejecución del envío.</small>
              </div>

              <div className={styles.templateControls}>
                <label>
                  <span>Plantilla</span>
                  <select
                    value={selectedTemplate}
                    onChange={(event) => handleTemplateChange(event.target.value)}
                    disabled={isLoadingTemplates || templates.length === 0 || isSending}
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
                  type="button"
                  onClick={() => void handleSaveTemplate()}
                  disabled={isSavingTemplate || isSending}
                >
                  {isSavingTemplate ? "Guardando…" : "Guardar como plantilla"}
                </button>
              </div>

              <label className={styles.messageField}>
                <span>Texto del mensaje</span>
                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setNotice(null);
                  }}
                  rows={7}
                  maxLength={capabilities?.max_message_length}
                  placeholder="Escribí aquí el aviso que recibirá el usuario…"
                  disabled={isSending}
                />
                <small>
                  {message.length} / {capabilities?.max_message_length ?? "…"}
                </small>
              </label>

              {notice ? (
                <div
                  className={`${styles.notice} ${styles[`notice--${notice.tone}`]}`}
                  role={notice.tone === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {notice.tone === "success" ? <CheckIcon /> : <span>!</span>}
                  <p>{notice.text}</p>
                </div>
              ) : null}

              {activeJob ? (
                <section className={styles.jobProgress} aria-label="Progreso del envío" aria-live="polite">
                  <div className={styles.jobProgressHeading}>
                    <div>
                      <span>ENVÍO EN SEGUNDO PLANO</span>
                      <strong>{messageJobStatusLabel(activeJob.status)}</strong>
                    </div>
                    <small>{activeJob.id}</small>
                  </div>
                  <progress
                    max={Math.max(activeJob.total, 1)}
                    value={Math.min(activeJob.accepted + activeJob.failed, activeJob.total)}
                  />
                  <dl>
                    <div><dt>Total</dt><dd>{activeJob.total}</dd></div>
                    <div><dt>Pendientes</dt><dd>{activeJob.pending}</dd></div>
                    <div><dt>Aceptados</dt><dd>{activeJob.accepted}</dd></div>
                    <div><dt>Fallidos</dt><dd>{activeJob.failed}</dd></div>
                  </dl>
                  {isTerminalMessageJob(activeJob) && activeJob.failed > 0 ? (
                    <button
                      type="button"
                      onClick={() => void handleRetryFailures()}
                      disabled={isRetryingJob}
                    >
                      {isRetryingJob ? "Reintentando…" : "Reintentar fallidos"}
                    </button>
                  ) : null}
                  <p>“Aceptado” confirma la recepción de Headwind; la entrega final depende de la conexión MQTT.</p>
                </section>
              ) : null}

              <button
                className={styles.sendButton}
                type="submit"
                disabled={
                  (targetMode === "devices" && selectedDevices.length === 0) ||
                  (targetMode === "group" && !selectedGroup) ||
                  !message.trim() ||
                  !branchId ||
                  isSending ||
                  isVerifying ||
                  isLoadingGroups ||
                  !capabilities
                }
              >
                {isSending ? <span className={styles.spinner} /> : <MessageIcon />}
                {isSending
                  ? targetMode === "devices"
                    ? "Creando envío…"
                    : "Enviando…"
                  : targetMode === "all"
                    ? "Enviar a todos los dispositivos"
                    : targetMode === "group"
                      ? `Enviar al grupo${selectedGroup ? ` ${selectedGroup.name}` : ""}`
                      : `Registrar envío a ${devicesForJob.length} identificador${devicesForJob.length === 1 ? "" : "es"}`}
              </button>
            </form>
          </section>
          ) : null}

        </div>

        <aside className={styles.sidebar}>
          <section className={styles.historyPreview} aria-labelledby="message-history-heading">
            <div className={styles.historyPreviewHeading}>
              <div>
                <h2 id="message-history-heading">Últimas ejecuciones</h2>
                <span><i />Actualizado hace instantes</span>
              </div>
              <button type="button" onClick={() => void loadJobHistory()} disabled={isLoadingHistory} aria-label="Actualizar ejecuciones">
                ↻
              </button>
            </div>
            {isLoadingHistory ? (
              <p className={styles.historyEmpty}>Cargando ejecuciones…</p>
            ) : jobHistory.length === 0 ? (
              <p className={styles.historyEmpty}>Todavía no hay envíos registrados.</p>
            ) : (
              <div className={styles.historyPreviewList}>
                {jobHistory.slice(0, 4).map((job) => (
                  <Link className={styles.historyPreviewItem} href={`/panel/mensajeria/historial?ejecucion=${encodeURIComponent(job.id)}`} key={job.id}>
                    <span className={styles.historyPreviewIcon}>
                      <MessageIcon />
                    </span>
                    <div className={styles.historyPreviewContent}>
                      <strong>Enviar mensaje</strong>
                      <span className={`${styles.historyPreviewStatus} ${job.status === "SUCCEEDED" ? "" : styles.historyPreviewStatusWarning}`}>
                        {job.status === "SUCCEEDED" ? <CheckIcon /> : "△"} {messageJobStatusLabel(job.status)}
                      </span>
                      <small>{relativeJobTime(job.createdAt)} · {job.total} equipo{job.total === 1 ? "" : "s"}</small>
                    </div>
                    <span className={styles.historyPreviewArrow}>›</span>
                  </Link>
                ))}
              </div>
            )}
            <Link className={styles.historyPreviewLink} href="/panel/mensajeria/historial">
              Ver historial completo
            </Link>
          </section>

        </aside>
      </div>

      <section className={styles.activity} aria-labelledby="message-activity-heading">
        <div className={styles.activityHeader}>
          <div>
            <span className={styles.liveDot} />
            <strong id="message-activity-heading">Actividad de la sesión</strong>
          </div>
          <button type="button" onClick={() => setLogs([])} disabled={logs.length === 0}>
            Limpiar
          </button>
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

      {isHistoryDrawerOpen ? (
        <>
          <button
            className={styles.detailDrawerBackdrop}
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
            aria-labelledby="all-message-history-heading"
          >
            <div className={styles.detailDrawerHeader}>
              <div>
                <span>{jobDetail ? "DETALLE DE EJECUCIÓN" : "HISTORIAL"}</span>
                <h2 id="all-message-history-heading">
                  {jobDetail ? messageJobStatusLabel(jobDetail.status) : "Todas las ejecuciones"}
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
                    className={styles.historyDrawerRefresh}
                    type="button"
                    onClick={returnToHistory}
                  >
                    ← Volver a ejecuciones
                  </button>
                  <button
                    className={styles.downloadSummaryButton}
                    type="button"
                    onClick={() => downloadJobSummary(jobDetail)}
                  >
                    Descargar Excel
                  </button>
                </div>
                <p className={styles.detailMessage}>{jobDetail.message}</p>
                <section className={`${styles.jobProgress} ${styles.detailJobProgress}`}>
                  <div className={styles.jobProgressHeading}>
                    <div>
                      <span>RESUMEN DE EJECUCIÓN</span>
                      <strong>{messageJobStatusLabel(jobDetail.status)}</strong>
                    </div>
                    <small>{jobDetail.id}</small>
                  </div>
                  <progress
                    max={Math.max(jobDetail.total, 1)}
                    value={Math.min(jobDetail.accepted + jobDetail.failed, jobDetail.total)}
                  />
                  <dl>
                    <div><dt>Total</dt><dd>{jobDetail.total}</dd></div>
                    <div><dt>Pendientes</dt><dd>{jobDetail.pending}</dd></div>
                    <div><dt>Aceptados</dt><dd>{jobDetail.accepted}</dd></div>
                    <div><dt>Fallidos</dt><dd>{jobDetail.failed}</dd></div>
                  </dl>
                </section>
                <div className={styles.detailDevices}>
                  {jobDetail.items.map((item) => (
                    <div key={item.deviceId}>
                      <strong>{item.deviceId}</strong>
                      <span>{messageJobItemStatusLabel(item.status)} · intento{item.attempts === 1 ? "" : "s"} {item.attempts}</span>
                      {item.lastError ? <small>{item.lastError}</small> : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  className={styles.historyDrawerRefresh}
                  type="button"
                  onClick={() => void loadJobHistory()}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "Actualizando…" : "Actualizar historial"}
                </button>
                {isLoadingHistory ? (
                  <p className={styles.historyEmpty}>Cargando ejecuciones…</p>
                ) : jobHistory.length === 0 ? (
                  <p className={styles.historyEmpty}>Todavía no hay envíos registrados.</p>
                ) : (
                  <div className={styles.historyDrawerList}>
                    {jobHistory.map((job) => (
                      <article className={styles.historyDrawerItem} key={job.id}>
                        <div>
                          <strong>{messageJobStatusLabel(job.status)}</strong>
                          <small>{formatJobDate(job.createdAt)} · {job.branchName || "Sin sucursal"}</small>
                        </div>
                        <dl>
                          <div><dt>Equipos</dt><dd>{job.total}</dd></div>
                          <div><dt>Aceptados</dt><dd>{job.accepted}</dd></div>
                          <div><dt>Fallidos</dt><dd>{job.failed}</dd></div>
                        </dl>
                        <div className={styles.historyActions}>
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
                          {isTerminalMessageJob(job) ? (
                            <button
                              type="button"
                              onClick={() => void handleRerun(job)}
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

    </div>
  );
}
