"use client";

import { type FormEvent, useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/icons";
import styles from "./change-password-form.module.css";

type PasswordFieldName =
  | "current_password"
  | "new_password"
  | "confirm_password";

type PasswordResponse = {
  status?: "success" | "error";
  message?: string;
  detail?: string;
  requires_login?: boolean;
  current_password?: string[];
  new_password?: string[];
  confirm_password?: string[];
};

type FieldErrors = Partial<Record<PasswordFieldName, string>>;

function firstError(data: PasswordResponse, field: PasswordFieldName) {
  return data[field]?.[0];
}

function PasswordField({
  id,
  label,
  value,
  autoComplete,
  error,
  visible,
  onChange,
  onToggle,
}: {
  id: PasswordFieldName;
  label: string;
  value: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={`${styles.input}${error ? ` ${styles.inputError}` : ""}`}>
        <LockIcon aria-hidden="true" />
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error ? (
        <span className={styles.fieldError} id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visibleFields, setVisibleFields] = useState<PasswordFieldName[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<
    { tone: "error" | "success"; message: string } | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);

  function updateField(
    field: PasswordFieldName,
    setter: (value: string) => void,
    value: string,
  ) {
    setter(value);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(undefined);
  }

  function toggleVisibility(field: PasswordFieldName) {
    setVisibleFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors = {};

    if (!currentPassword) errors.current_password = "Ingresá tu contraseña actual.";
    if (!newPassword) errors.new_password = "Ingresá una contraseña nueva.";
    if (!confirmPassword) errors.confirm_password = "Confirmá la contraseña nueva.";
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errors.confirm_password = "Las contraseñas nuevas no coinciden.";
    }

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setNotice(undefined);
      return;
    }

    setIsLoading(true);
    setFieldErrors({});
    setNotice(undefined);

    try {
      const response = await fetch("/api/auth/staff/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = (await response.json()) as PasswordResponse;

      if (response.status === 401 || response.status === 403 || data.requires_login) {
        window.location.assign("/");
        return;
      }

      if (!response.ok || data.status !== "success") {
        setFieldErrors({
          current_password: firstError(data, "current_password"),
          new_password: firstError(data, "new_password"),
          confirm_password: firstError(data, "confirm_password"),
        });
        setNotice({
          tone: "error",
          message:
            data.message ??
            data.detail ??
            "No pudimos actualizar tu contraseña. Revisá los campos.",
        });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setVisibleFields([]);
      setNotice({
        tone: "success",
        message: data.message ?? "Tu contraseña fue actualizada.",
      });
    } catch {
      setNotice({
        tone: "error",
        message: "No pudimos conectar con el servicio. Intentá nuevamente.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <PasswordField
        id="current_password"
        label="Contraseña actual"
        value={currentPassword}
        autoComplete="current-password"
        error={fieldErrors.current_password}
        visible={visibleFields.includes("current_password")}
        onChange={(value) =>
          updateField("current_password", setCurrentPassword, value)
        }
        onToggle={() => toggleVisibility("current_password")}
      />
      <PasswordField
        id="new_password"
        label="Nueva contraseña"
        value={newPassword}
        autoComplete="new-password"
        error={fieldErrors.new_password}
        visible={visibleFields.includes("new_password")}
        onChange={(value) => updateField("new_password", setNewPassword, value)}
        onToggle={() => toggleVisibility("new_password")}
      />
      <PasswordField
        id="confirm_password"
        label="Confirmar nueva contraseña"
        value={confirmPassword}
        autoComplete="new-password"
        error={fieldErrors.confirm_password}
        visible={visibleFields.includes("confirm_password")}
        onChange={(value) =>
          updateField("confirm_password", setConfirmPassword, value)
        }
        onToggle={() => toggleVisibility("confirm_password")}
      />

      <p className={styles.help}>
        Usá al menos 8 caracteres y evitá contraseñas comunes, exclusivamente
        numéricas o similares a tu usuario.
      </p>

      {notice ? (
        <p
          className={`${styles.notice} ${styles[`notice--${notice.tone}`]}`}
          role={notice.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {notice.message}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={isLoading}>
        {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : null}
        {isLoading ? "Actualizando..." : "Actualizar contraseña"}
      </button>
    </form>
  );
}
