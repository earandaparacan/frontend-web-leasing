"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
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
};

type ApiResponse = {
  status?: string;
  message?: string;
  error?: string;
  results?: unknown;
};

function responseMessage(data: ApiResponse) {
  return data.message ?? data.error ?? "No se pudo completar la operación.";
}

function isDevice(value: unknown): value is Device {
  if (typeof value !== "object" || value === null) return false;
  const device = value as Record<string, unknown>;
  return typeof device.device_id === "string" && typeof device.found === "boolean";
}

export function MdmMessaging() {
  const [identifier, setIdentifier] = useState("");
  const [verifiedDevice, setVerifiedDevice] = useState<Device | null>(null);
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const normalizedIdentifier = identifier.trim();
  const isVerified =
    verifiedDevice !== null && verifiedDevice.device_id === normalizedIdentifier;

  function handleIdentifierChange(value: string) {
    setIdentifier(value);
    setNotice(null);
    if (verifiedDevice && verifiedDevice.device_id !== value.trim()) {
      setVerifiedDevice(null);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedIdentifier || normalizedIdentifier.length > 128) {
      setNotice({ tone: "error", text: "Ingresá un Device ID o IMEI válido." });
      return;
    }

    setIsVerifying(true);
    setNotice(null);
    setVerifiedDevice(null);

    try {
      const response = await fetch("/api/mdm/devices/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devices: [normalizedIdentifier] }),
      });
      const data = (await response.json()) as ApiResponse;
      const result = Array.isArray(data.results) ? data.results[0] : undefined;

      if (!response.ok || data.status !== "success") {
        throw new Error(responseMessage(data));
      }
      if (!isDevice(result)) {
        throw new Error("Headwind MDM devolvió una respuesta incompleta.");
      }
      if (!result.found) {
        throw new Error("No encontramos un dispositivo con ese identificador.");
      }

      setIdentifier(result.device_id);
      setVerifiedDevice(result);
      setNotice(null);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo verificar el dispositivo.",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanMessage = message.trim();

    if (!isVerified || !verifiedDevice) {
      setNotice({ tone: "error", text: "Verificá el dispositivo antes de enviar." });
      return;
    }
    if (!cleanMessage || cleanMessage.length > 1000) {
      setNotice({
        tone: "error",
        text: "El mensaje debe contener entre 1 y 1000 caracteres.",
      });
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      const response = await fetch("/api/mdm/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_number: verifiedDevice.device_id,
          message: cleanMessage,
        }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.status !== "success") {
        throw new Error(responseMessage(data));
      }

      setMessage("");
      setNotice({
        tone: "success",
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
            Enviá avisos a un dispositivo registrado. La web nunca accede a las
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
                <strong>Seleccioná el dispositivo</strong>
                <small>Buscá por Device ID o IMEI.</small>
              </div>
            </div>

            <form className={styles.deviceSearch} onSubmit={handleVerify}>
              <label>
                <span className="sr-only">Device ID o IMEI</span>
                <DeviceIcon />
                <input
                  value={identifier}
                  onChange={(event) => handleIdentifierChange(event.target.value)}
                  placeholder="Ej. prueba o 356789…"
                  autoComplete="off"
                  maxLength={128}
                  disabled={isVerifying || isSending}
                />
              </label>
              <button type="submit" disabled={isVerifying || isSending || !normalizedIdentifier}>
                {isVerifying ? <span className={styles.spinner} /> : "Verificar"}
              </button>
            </form>

            {isVerified && verifiedDevice ? (
              <div className={styles.deviceCard}>
                <span className={styles.deviceStatus}><CheckIcon /></span>
                <div>
                  <strong>{verifiedDevice.device_id}</strong>
                  <small>{verifiedDevice.description || "Dispositivo registrado"}</small>
                </div>
                <dl>
                  <div><dt>IMEI</dt><dd>{verifiedDevice.imei || "Sin datos"}</dd></div>
                  <div><dt>Grupo</dt><dd>{verifiedDevice.groups || "Sin grupo"}</dd></div>
                </dl>
              </div>
            ) : null}

            <form className={styles.messageForm} onSubmit={handleSend}>
              <div className={styles.stepHeading}>
                <span>2</span>
                <div>
                  <strong>Escribí el mensaje</strong>
                  <small>El aviso aparecerá en el dispositivo seleccionado.</small>
                </div>
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
                disabled={!isVerified || !message.trim() || isSending || isVerifying}
              >
                {isSending ? <span className={styles.spinner} /> : <MessageIcon />}
                {isSending ? "Enviando…" : "Enviar mensaje"}
              </button>
            </form>
          </div>
        </section>

        <aside className={styles.helpCard}>
          <div className={styles.helpIcon}><ShieldIcon /></div>
          <span>ENVÍO SEGURO</span>
          <h2>Cómo funciona</h2>
          <ol>
            <li><i>1</i><p><strong>Verificación</strong><small>Confirmamos que el equipo existe en Headwind MDM.</small></p></li>
            <li><i>2</i><p><strong>Envío interno</strong><small>Django autentica la solicitud sin compartir secretos con la web.</small></p></li>
            <li><i>3</i><p><strong>Entrega por MQTT</strong><small>Headwind remite el aviso al agente instalado.</small></p></li>
          </ol>
          <div className={styles.helpNote}>
            <MessageIcon />
            <p><strong>Antes de enviar</strong><span>Revisá el dispositivo y el contenido. El envío queda auditado.</span></p>
          </div>
        </aside>
      </div>
    </div>
  );
}
