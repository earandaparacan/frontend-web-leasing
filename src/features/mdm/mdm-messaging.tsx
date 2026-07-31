"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  DeviceIcon,
  MessageIcon,
  ShieldIcon,
} from "@/components/icons";
import styles from "./mdm-messaging.module.css";

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

type ApiResponse = {
  status?: string;
  message?: string;
  error?: string;
  results?: unknown;
  groups?: unknown;
  templates?: unknown;
  template?: unknown;
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

function parseIdentifiers(value: string) {
  return [...new Set(value.split(/[\r\n,;\t]+/).map((item) => item.trim()).filter(Boolean))];
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
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

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
          !data.templates.every(
            (template) => typeof template === "string" && template.length <= 1000,
          )
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

  function handleIdentifierChange(value: string) {
    setInput(value);
    setNotice(null);
    setDevices([]);
    setSelected(new Set());
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      identifiers.length === 0 ||
      identifiers.length > 100 ||
      identifiers.some((identifier) => identifier.length > 128)
    ) {
      setNotice({
        tone: "error",
        text: "Ingresá entre 1 y 100 Device IDs o IMEIs válidos.",
      });
      return;
    }

    setIsVerifying(true);
    setNotice(null);
    setDevices([]);
    setSelected(new Set());

    try {
      const response = await fetch("/api/mdm/devices/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devices: identifiers }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || data.status !== "success") {
        throw new Error(responseMessage(data));
      }
      if (!Array.isArray(data.results)) {
        throw new Error("Headwind MDM devolvió una respuesta incompleta.");
      }
      const verifiedDevices = data.results.filter(isDevice);
      if (verifiedDevices.length !== data.results.length) {
        throw new Error("Headwind MDM devolvió datos incompletos.");
      }

      const foundDevices = verifiedDevices.filter((device) => device.found);
      setDevices(verifiedDevices);
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

    if (targetMode === "devices" && selectedDevices.length === 0) {
      setNotice({ tone: "error", text: "Seleccioná al menos un dispositivo verificado." });
      return;
    }
    if (targetMode === "group" && !selectedGroup) {
      setNotice({ tone: "error", text: "Seleccioná un grupo antes de enviar." });
      return;
    }
    if (!cleanMessage || cleanMessage.length > 1000) {
      setNotice({
        tone: "error",
        text: "El mensaje debe contener entre 1 y 1000 caracteres.",
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

    setIsSending(true);
    setNotice(null);

    try {
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
          text:
            data.message ??
            (targetMode === "all"
              ? "Mensaje enviado a todos los dispositivos."
              : "Mensaje enviado al grupo seleccionado."),
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
        text: data.message ?? "Mensaje enviado al dispositivo.",
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
                    <small>{identifiers.length} / 100</small>
                  </label>
                  <button type="submit" disabled={isVerifying || isSending || identifiers.length === 0}>
                    {isVerifying ? <span className={styles.spinner} /> : "Verificar"}
                  </button>
                </form>

                {devices.length > 0 ? (
                  <div className={styles.deviceList} aria-label="Dispositivos verificados">
                    {devices.map((device) =>
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
                    <div className={styles.selectionSummary}>
                      {selectedDevices.length} dispositivo{selectedDevices.length === 1 ? "" : "s"} seleccionado{selectedDevices.length === 1 ? "" : "s"}
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
                  maxLength={1000}
                  placeholder="Escribí aquí el aviso que recibirá el usuario…"
                  disabled={isSending}
                />
                <small>{message.length} / 1000</small>
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

              <button
                className={styles.sendButton}
                type="submit"
                disabled={
                  (targetMode === "devices" && selectedDevices.length === 0) ||
                  (targetMode === "group" && !selectedGroup) ||
                  !message.trim() ||
                  isSending ||
                  isVerifying ||
                  isLoadingGroups
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
