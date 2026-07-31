"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckIcon, LockIcon, ShieldIcon } from "@/components/icons";
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

type ActionResult = {
  device_id: string;
  success: boolean;
  message: string;
};

type ActionResponse = {
  status?: string;
  results?: unknown;
  message?: string;
  error?: string;
};

type TemplateResponse = {
  status?: string;
  templates?: unknown;
  template?: unknown;
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

function isActionResult(value: unknown): value is ActionResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.device_id === "string" &&
    typeof result.success === "boolean" &&
    typeof result.message === "string"
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

export function DeviceManagement() {
  const [input, setInput] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [pendingAction, setPendingAction] = useState<"lock" | "unlock" | null>(null);
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
  const allVisibleSelected =
    visibleDevices.some((device) => device.found) &&
    visibleDevices.filter((device) => device.found).every((device) => selected.has(device.device_id));

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

    if (deviceIdentifiers.length > 100) {
      setNotice("Podés consultar hasta 100 dispositivos por vez.");
      return;
    }

    setIsQuerying(true);
    setNotice("");
    addLog(`Consultando ${deviceIdentifiers.length} dispositivo(s)…`);

    try {
      const response = await fetch("/api/mdm/devices/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devices: deviceIdentifiers }),
      });
      const data = (await response.json()) as QueryResponse;

      if (!response.ok || data.status !== "success" || !Array.isArray(data.results)) {
        throw new Error(responseMessage(data));
      }

      const validResults = data.results.filter(isDevice);
      if (validResults.length !== data.results.length) {
        throw new Error("El servicio MDM devolvió datos incompletos.");
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
    if (selectedDevices.length === 0) return;

    const actionLabel = action === "lock" ? "bloquear" : "desbloquear";
    if (!window.confirm(`¿Confirmás ${actionLabel} ${selectedDevices.length} dispositivo(s)?`)) {
      return;
    }

    setPendingAction(action);
    setNotice("");
    addLog(`Enviando comando para ${actionLabel} ${selectedDevices.length} dispositivo(s)…`);

    try {
      const response = await fetch("/api/mdm/devices/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          devices: selectedDevices.map((device) => ({
            number: device.device_id,
            db_id: device.db_id,
          })),
          action,
          message: action === "lock" ? message.trim() : "",
        }),
      });
      const data = (await response.json()) as ActionResponse;

      if (!response.ok || data.status !== "success" || !Array.isArray(data.results)) {
        throw new Error(responseMessage(data));
      }

      const validResults = data.results.filter(isActionResult);
      if (validResults.length !== data.results.length) {
        throw new Error("El servicio MDM devolvió un resultado de acción incompleto.");
      }

      validResults.forEach((result) => addLog(result.message, result.success ? "success" : "error"));
      const successfulIds = new Set(
        validResults.filter((result) => result.success).map((result) => result.device_id),
      );
      setDevices((current) =>
        current.map((device) =>
          successfulIds.has(device.device_id)
            ? { ...device, status: action === "lock" ? "Bloqueado" : "Libre" }
            : device,
        ),
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
            <span className={styles.counter}>{identifiers.length} / 100</span>
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
                  disabled={pendingAction !== null}
                >
                  <UnlockIcon />
                  {pendingAction === "unlock" ? "Desbloqueando…" : "Desbloquear seleccionados"}
                </button>
                <button
                  className={styles.lockButton}
                  type="button"
                  onClick={() => triggerAction("lock")}
                  disabled={pendingAction !== null}
                >
                  <LockIcon />
                  {pendingAction === "lock" ? "Bloqueando…" : "Bloquear seleccionados"}
                </button>
              </div>
            </div>
          ) : null}
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
