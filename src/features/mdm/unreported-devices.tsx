"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangleIcon, DeviceIcon } from "@/components/icons";
import styles from "./unreported-devices.module.css";

type UnreportedDevice = {
  device_id: string;
  imei?: string;
  description?: string;
  configuration_name?: string;
  groups?: string;
  last_reported_at?: string | null;
  found: boolean;
};

type WithoutReportResponse = {
  status?: string;
  results?: unknown;
  message?: string;
  error?: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "success"; devices: UnreportedDevice[] }
  | { status: "error"; message: string };

function isUnreportedDevice(value: unknown): value is UnreportedDevice {
  if (typeof value !== "object" || value === null) return false;
  const device = value as Record<string, unknown>;
  return (
    typeof device.device_id === "string" &&
    typeof device.found === "boolean" &&
    (device.last_reported_at === undefined ||
      device.last_reported_at === null ||
      typeof device.last_reported_at === "string")
  );
}

function responseMessage(data: WithoutReportResponse) {
  return data.message ?? data.error ?? "No se pudo consultar el detalle de equipos.";
}

function formatLastReport(value: string | null | undefined) {
  if (!value) return "Nunca reportó";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function UnreportedDevices() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadDevices() {
      try {
        const response = await fetch("/api/mdm/devices/without-report?period=7d", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as WithoutReportResponse;
        if (!response.ok || data.status !== "success" || !Array.isArray(data.results)) {
          throw new Error(responseMessage(data));
        }

        const devices = data.results.filter(isUnreportedDevice);
        if (devices.length !== data.results.length) {
          throw new Error("El servicio devolvió datos incompletos.");
        }
        setState({ status: "success", devices });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "No se pudo consultar el detalle de equipos.",
        });
      }
    }

    void loadDevices();
    return () => controller.abort();
  }, []);

  const deviceCount = state.status === "success" ? state.devices.length : null;

  return (
    <div className={`${styles.page} workspace-page`}>
      <section className={styles.hero}>
        <div>
          <Link className={styles.backLink} href="/panel">Volver al panel</Link>
          <span className={styles.kicker}>SEGUIMIENTO MDM</span>
          <h1>Equipos sin reporte</h1>
          <p>Estos equipos no se comunicaron con la plataforma durante los últimos 7 días.</p>
        </div>
        <div className={styles.summary}>
          <AlertTriangleIcon />
          <div>
            <strong>{deviceCount === null ? "Cargando detalle" : `${deviceCount} equipos a revisar`}</strong>
            <span>Priorizá los equipos que nunca reportaron o llevan más tiempo sin conexión.</span>
          </div>
        </div>
      </section>

      {state.status === "loading" ? (
        <div className={styles.loading} role="status">Cargando equipos sin reporte…</div>
      ) : null}

      {state.status === "error" ? (
        <div className={styles.error} role="alert">{state.message}</div>
      ) : null}

      {state.status === "success" ? (
        <section className={styles.list} aria-labelledby="devices-heading">
          <div className={styles.listHeading}>
            <div>
              <h2 id="devices-heading">Detalle de equipos</h2>
              <p>La lista se actualiza al ingresar a esta página.</p>
            </div>
            <span>{state.devices.length} en total</span>
          </div>

          {state.devices.length ? (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Asignación</th>
                    <th>Último reporte</th>
                    <th>Situación</th>
                  </tr>
                </thead>
                <tbody>
                  {state.devices.map((device) => (
                    <tr key={device.device_id}>
                      <td>
                        <strong><DeviceIcon />{device.device_id}</strong>
                        <small>IMEI: {device.imei || "No disponible"}</small>
                        {device.description ? <span>{device.description}</span> : null}
                      </td>
                      <td>
                        <strong>{device.configuration_name || "Sin configuración"}</strong>
                        <small>{device.groups || "Sin grupo"}</small>
                      </td>
                      <td>{formatLastReport(device.last_reported_at)}</td>
                      <td><span className={styles.status}>Sin comunicación</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>No hay equipos sin reporte durante los últimos 7 días.</div>
          )}
        </section>
      ) : null}
    </div>
  );
}
