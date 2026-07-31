"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/icons";

type StaffUser = {
  id: string;
  username: string;
  user_type: "staff";
  groups: string[];
  permissions: string[];
};

type LoginResponse = {
  status?: "success" | "error";
  message?: string;
  username?: string[];
  password?: string[];
  user?: StaffUser;
};

function getErrorMessage(data: LoginResponse): string {
  if (typeof data.message === "string") {
    return data.message;
  }

  return (
    data.username?.[0] ??
    data.password?.[0] ??
    "No pudimos iniciar sesión. Intentá nuevamente."
  );
}

export function LoginExperience() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Completá tu usuario y contraseña.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          remember,
        }),
      });
      const data = (await response.json()) as LoginResponse;

      if (!response.ok || data.user?.user_type !== "staff") {
        setError(getErrorMessage(data));
        return;
      }

      window.location.assign("/panel");
    } catch {
      setError("No pudimos conectar con el servicio. Revisá tu conexión.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <aside className="brand-panel" aria-label="Teklease">
        <Image
          src="/images/login-device.png"
          alt=""
          fill
          priority
          sizes="(min-width: 960px) 44vw, 0px"
          className="brand-panel__image"
        />
        <div className="brand-panel__veil" />

        <div className="brand-panel__content">
          <Link className="wordmark wordmark--light" href="/" aria-label="Teklease, inicio">
            teklease<span>.</span>
          </Link>

          <div className="brand-copy">
            <p className="eyebrow eyebrow--light">Gestión sin complicaciones</p>
            <h1>
              Todo tu trabajo,
              <br />
              en un solo lugar.
            </h1>
            <p className="brand-copy__description">
              Atendé a cada cliente con la información, las herramientas y el
              respaldo que necesitás.
            </p>
            <div className="benefit-list" aria-label="Áreas habilitadas">
              <span>Atención al cliente</span>
              <span>Cobranzas</span>
              <span>Soporte</span>
              <span>Gerencia</span>
            </div>
          </div>

          <p className="secure-caption secure-caption--dark">
            <span>
              <CheckIcon />
            </span>
            Acceso exclusivo para el equipo Teklease
          </p>
        </div>
      </aside>

      <section className="form-panel">
        <header className="mobile-header">
          <Link className="wordmark" href="/" aria-label="Teklease, inicio">
            teklease<span>.</span>
          </Link>
          <span>Portal interno</span>
        </header>

        <div className="form-panel__top">
          <span className="portal-label">Portal interno</span>
          <a href="mailto:soporte@teklease.com.py">¿Necesitás ayuda?</a>
        </div>

        <div className="auth-card">
          <div className="brand-marker" />
          <div className="auth-heading">
            <span className="auth-heading__kicker">Acceso administrativo</span>
            <h2>Bienvenido de vuelta.</h2>
            <p>
              Ingresá con tus credenciales internas para acceder a las
              herramientas de gestión.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field-stack">
              <div className="field-group">
                <label htmlFor="username">Usuario</label>
                <div
                  className={`input-shell${error ? " input-shell--error" : ""}`}
                >
                  <UserIcon />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="tu.usuario"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setError("");
                    }}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                    autoFocus
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="password">Contraseña</label>
                <div
                  className={`input-shell${error ? " input-shell--error" : ""}`}
                >
                  <LockIcon />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Ingresá tu contraseña"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            </div>

            <div className="form-meta">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span className="checkbox__box">
                  <CheckIcon />
                </span>
                Recordarme
              </label>

              <a
                className="forgot-link"
                href="mailto:soporte@teklease.com.py?subject=Recuperar acceso al portal interno"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {error ? (
              <p className="form-error" id="login-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              className="primary-button"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? <span className="spinner" /> : null}
              {isLoading ? "Ingresando..." : "Ingresar a mi cuenta"}
              {!isLoading ? <ChevronRightIcon /> : null}
            </button>
          </form>

          <p className="secure-caption secure-caption--light">
            <span>
              <ShieldIcon />
            </span>
            Tus credenciales están protegidas
          </p>
        </div>

        <footer className="form-panel__footer">
          <span>© {new Date().getFullYear()} Teklease</span>
          <span>Uso interno · Acceso monitoreado</span>
        </footer>
      </section>
    </main>
  );
}
