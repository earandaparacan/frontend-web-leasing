import type { Metadata } from "next";
import Link from "next/link";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { getStaffUser } from "@/lib/staff-session";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Mi cuenta | Teklease",
  description: "Configuración de la cuenta interna de Teklease.",
};

export default async function AccountPage() {
  const user = await getStaffUser();

  return (
    <div className={`workspace-page ${styles.page}`}>
      <nav className={styles.breadcrumb} aria-label="Migas de pan">
        <Link href="/panel">Dashboard</Link>
        <span aria-hidden="true">/</span>
        <span>Mi cuenta</span>
      </nav>

      <header className={styles.header}>
        <span>SEGURIDAD DE LA CUENTA</span>
        <h1>Mi cuenta</h1>
        <p>Administrá tus credenciales de acceso al panel interno.</p>
      </header>

      <div className={styles.grid}>
        <section className={styles.profileCard} aria-labelledby="profile-title">
          <span className={styles.avatar} aria-hidden="true">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <span>USUARIO AUTENTICADO</span>
            <h2 id="profile-title">{user.username}</h2>
            <p>
              {user.is_superuser
                ? "Administrador"
                : user.groups.join(", ") || "Usuario interno"}
            </p>
          </div>
        </section>

        <section className={styles.passwordCard} aria-labelledby="password-title">
          <div className={styles.cardHeader}>
            <span>ACCESO</span>
            <h2 id="password-title">Cambiar contraseña</h2>
            <p>
              Confirmá tu contraseña actual antes de establecer una nueva.
              Las demás sesiones abiertas se cerrarán automáticamente.
            </p>
          </div>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
