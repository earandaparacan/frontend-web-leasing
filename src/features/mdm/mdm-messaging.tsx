"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  messageJobStatusLabel,
  parseMessageJob,
  type MessageJob,
} from "./mdm-message-job";

const DEVICE_RESULTS_PAGE_SIZE = 100;
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

type MessageResult = {
  device_id: string;
  success: boolean;
  message: string;
};

type DeviceGroup = {
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
  templates?: unknown;
  template?: unknown;
  job?: unknown;
  capabilities?: unknown;
};

function responseMessage(data: ApiResponse) {
  return data.message ?? data.error ?? "No se pudo completar la operación.";
}

function isDevice(value: unknown): value is Device {
  if (typeof value !== "object" || value === null) return false;
  const device = value as Record<string, unknown>;
  return typeof device.device_id === "string" && typeof device.found === "boolean";
}

function isMessageResult(value: unknown): value is MessageResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.device_id === "string" &&
    typeof result.success === "boolean" &&
    typeof result.message === "string"
  );
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

export function MdmMessaging() {
  const [targetMode, setTargetMode] = useState<"devices" | "group" | "all">("devices");
  const [input, setInput] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [capabilities, setCapabilities] = useState<MdmCapabilities | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRetryingJob, setIsRetryingJob] = useState(false);
  const [activeJob, setActiveJob] = useState<MessageJob | null>(null);
  const [visibleDeviceCount, setVisibleDeviceCount] = useState(DEVICE_RESULTS_PAGE_SIZE);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const jobRequestRef = useRef<{ signature: string; key: string } | null>(null);

  const identifiers = useMemo(() => parseIdentifiers(input), [input]);
  const selectedDevices = devices.filter(
    (device) => device.found && selected.has(device.device_id),
  );
  const selectedGroup = groups.find((group) => group.id === Number(selectedGroupId));

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
        if (job.status === "SUCCEEDED") {
          continuePolling = false;
          setNotice({ tone: "success", text: "Headwind aceptó todos los mensajes del envío." });
        } else if (isTerminalMessageJob(job)) {
          continuePolling = false;
          setNotice({
            tone: "error",
            text: `El envío terminó con ${job.failed} dispositivo${job.failed === 1 ? "" : "s"} fallido${job.failed === 1 ? "" : "s"}.`,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "No se pudo actualizar el progreso.",
        });
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
    setVisibleDeviceCount(DEVICE_RESULTS_PAGE_SIZE);
  }

  async function handleDeviceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!capabilities) {
      setNotice({ tone: "error", text: "La configuración MDM todavía está cargando." });
      return;
    }
    if (file.size > capabilities.max_import_bytes) {
      setNotice({
        tone: "error",
        text: `El archivo no puede superar ${Math.ceil(capabilities.max_import_bytes / 1_000_000)} MB.`,
      });
      return;
    }

    try {
      handleIdentifierChange(await file.text());
    } catch {
      setNotice({ tone: "error", text: "No se pudo leer el archivo seleccionado." });
    }
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

      const foundDevices = verifiedDevices.filter((device) => device.found);
      setDevices(verifiedDevices);
      setVisibleDeviceCount(DEVICE_RESULTS_PAGE_SIZE);
      setSelected(new Set(foundDevices.map((device) => device.device_id)));
      setNotice(
        foundDevices.length === 0
          ? { tone: "error", text: "No encontramos ningún dispositivo registrado." }
          : null,
      );
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo verificar el dispositivo.",
      });
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

    if (!capabilities) {
      setNotice({ tone: "error", text: "La configuración MDM todavía está cargando." });
      return;
    }

    if (targetMode === "devices" && selectedDevices.length === 0) {
      setNotice({ tone: "error", text: "Seleccioná al menos un dispositivo verificado." });
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
      selectedDevices.length > capabilities.query_batch_size &&
      !window.confirm(
        `¿Confirmás el envío en segundo plano a ${selectedDevices.length} dispositivos?`,
      )
    ) {
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      if (
        targetMode === "devices" &&
        selectedDevices.length > capabilities.query_batch_size
      ) {
        const jobDevices = selectedDevices.map((device) => device.device_id);
        const signature = `${cleanMessage}\u0000${jobDevices.join("\u0000")}`;
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
            devices: jobDevices,
            message: cleanMessage,
          }),
        });
        const data = (await response.json()) as ApiResponse;
        const job = parseMessageJob(data);
        if (!response.ok || data.status !== "success" || !job) {
          throw new Error(responseMessage(data));
        }

        setActiveJob(job);
        jobRequestRef.current = null;
        setMessage("");
        setNotice({
          tone: "success",
          text: `Envío ${job.id} creado. Podés seguir el progreso sin mantener esta solicitud abierta.`,
        });
        return;
      }

      const response = await fetch("/api/mdm/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          targetMode === "all"
            ? { scope: "all", message: cleanMessage }
            : targetMode === "group"
              ? { scope: "group", group_id: selectedGroup?.id, message: cleanMessage }
              : {
                  scope: "devices",
                  devices: selectedDevices.map((device) => device.device_id),
                  message: cleanMessage,
                },
        ),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.status !== "success") {
        throw new Error(responseMessage(data));
      }
      if (targetMode !== "devices") {
        setMessage("");
        setNotice({
          tone: "success",
          text: "Mensaje aceptado por Headwind.",
        });
        return;
      }
      if (!Array.isArray(data.results)) {
        throw new Error("El servicio MDM devolvió un resultado incompleto.");
      }
      const results = data.results.filter(isMessageResult);
      if (results.length !== data.results.length) {
        throw new Error("El servicio MDM devolvió resultados incompletos.");
      }

      const failedIds = new Set(
        results.filter((result) => !result.success).map((result) => result.device_id),
      );
      setSelected(failedIds);
      if (failedIds.size === 0) setMessage("");
      setNotice({
        tone: failedIds.size === 0 ? "success" : "error",
        text:
          failedIds.size === 0
            ? "Mensaje aceptado por Headwind."
            : data.message ?? "No se pudo enviar el mensaje a todos los dispositivos.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo enviar el mensaje.",
      });
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
      setNotice({ tone: "success", text: "Los errores transitorios volvieron a la cola." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudieron reintentar los fallidos.",
      });
    } finally {
      setIsRetryingJob(false);
    }
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
        <section className={styles.card} aria-labelledby="message-heading">
          <div className={styles.cardHeader}>
            <div>
              <span>NUEVO MENSAJE</span>
              <h2 id="message-heading">Preparar envío</h2>
            </div>
            <span className={styles.secureBadge}><ShieldIcon /> Canal protegido</span>
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
                      rows={3}
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

                <div className={styles.importTools}>
                  <span>Un identificador por línea, o separados por coma.</span>
                  <label>
                    Importar CSV o TXT
                    <input
                      type="file"
                      accept=".csv,.txt,text/csv,text/plain"
                      onChange={(event) => void handleDeviceFile(event)}
                      disabled={isVerifying || isSending || !capabilities}
                    />
                  </label>
                </div>

                {devices.length > 0 ? (
                  <div className={styles.deviceList} aria-label="Dispositivos verificados">
                    {devices.slice(0, visibleDeviceCount).map((device) =>
                      device.found ? (
                        <div
                          className={`${styles.deviceCard} ${
                            selected.has(device.device_id) ? styles.selectedDevice : ""
                          }`}
                          key={device.device_id}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(device.device_id)}
                            onChange={() => toggleDevice(device.device_id)}
                            disabled={isSending}
                            aria-label={`Seleccionar ${device.device_id}`}
                          />
                          <span className={styles.deviceStatus}><CheckIcon /></span>
                          <div>
                            <strong>{device.device_id}</strong>
                            <small>{device.description || "Dispositivo registrado"}</small>
                          </div>
                          <dl>
                            <div><dt>IMEI</dt><dd>{device.imei || "Sin datos"}</dd></div>
                            <div><dt>Grupo</dt><dd>{device.groups || "Sin grupo"}</dd></div>
                          </dl>
                        </div>
                      ) : (
                        <div className={styles.missingDevice} key={device.device_id}>
                          <span>!</span>
                          <p>
                            <strong>{device.device_id}</strong>
                            <small>{device.error || "No registrado en el servidor MDM"}</small>
                          </p>
                        </div>
                      ),
                    )}
                    {visibleDeviceCount < devices.length ? (
                      <button
                        className={styles.showMoreButton}
                        type="button"
                        onClick={() =>
                          setVisibleDeviceCount((current) =>
                            Math.min(current + DEVICE_RESULTS_PAGE_SIZE, devices.length),
                          )
                        }
                      >
                        Mostrar {Math.min(DEVICE_RESULTS_PAGE_SIZE, devices.length - visibleDeviceCount)} más
                      </button>
                    ) : null}
                    <div className={styles.selectionSummary}>
                      <span>
                        {selectedDevices.length} dispositivo{selectedDevices.length === 1 ? "" : "s"} seleccionado{selectedDevices.length === 1 ? "" : "s"}
                      </span>
                      <button type="button" onClick={() => setSelected(new Set())} disabled={isSending}>
                        Quitar selección
                      </button>
                    </div>
                  </div>
                ) : null}
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

            <form className={styles.messageForm} onSubmit={handleSend}>
              <div className={styles.stepHeading}>
                <span>2</span>
                <div>
                  <strong>Escribí el mensaje</strong>
                  <small>
                    {targetMode === "all"
                      ? "El aviso se enviará a toda la flota registrada."
                      : targetMode === "group"
                        ? "El aviso se enviará a todos los equipos del grupo elegido."
                        : "El aviso aparecerá en todos los dispositivos seleccionados."}
                  </small>
                </div>
              </div>

              <div className={styles.templateControls}>
                <label>
                  <span>Plantilla</span>
                  <select
                    defaultValue=""
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
                  isSending ||
                  isVerifying ||
                  isLoadingGroups ||
                  !capabilities
                }
              >
                {isSending ? <span className={styles.spinner} /> : <MessageIcon />}
                {isSending
                  ? "Enviando…"
                  : targetMode === "all"
                    ? "Enviar a todos los dispositivos"
                    : targetMode === "group"
                      ? `Enviar al grupo${selectedGroup ? ` ${selectedGroup.name}` : ""}`
                      : `Enviar a ${selectedDevices.length} dispositivo${selectedDevices.length === 1 ? "" : "s"}`}
              </button>
            </form>
          </div>
        </section>

        <aside className={styles.helpCard}>
          <div className={styles.helpIcon}><ShieldIcon /></div>
          <span>ENVÍO SEGURO</span>
          <h2>Cómo funciona</h2>
          <ol>
            <li><i>1</i><p><strong>Verificación</strong><small>Confirmamos que los equipos existen en Headwind MDM.</small></p></li>
            <li><i>2</i><p><strong>Envío interno</strong><small>Django autentica la solicitud sin compartir secretos con la web.</small></p></li>
            <li><i>3</i><p><strong>Entrega por MQTT</strong><small>Headwind remite el aviso al agente instalado.</small></p></li>
          </ol>
          <div className={styles.helpNote}>
            <MessageIcon />
            <p><strong>Antes de enviar</strong><span>Revisá los dispositivos y el contenido. El envío queda auditado.</span></p>
          </div>
        </aside>
      </div>
    </div>
  );
}
