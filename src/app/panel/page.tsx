import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRightIcon,
  DeviceIcon,
  KeyIcon,
  ReceiptIcon,
  UsersIcon,
} from "@/components/icons";
import { getStaffUser } from "@/lib/staff-session";
import styles from "./panel.module.css";

export const metadata: Metadata = {
  title: "Dashboard | Teklease",
  description: "Resumen operativo del portal administrativo de Teklease.",
};

const modules = [
  {
    href: "/panel/dispositivos",
    label: "Control de equipos",
    description: "Consultá dispositivos y ejecutá acciones de bloqueo o desbloqueo.",
    status: "Operativo",
    tone: "orange",
    icon: DeviceIcon,
  },
  {
    href: "/panel/desafios-otp",
    label: "Desafíos OTP",
    description: "Supervisá validaciones, estados y vencimientos de seguridad.",
    status: "API conectada",
    tone: "purple",
    icon: KeyIcon,
  },
  {
    href: "/panel/usuarios",
    label: "Usuarios",
    description: "Administrá usuarios, acceso y estado de sus cuentas.",
    status: "API conectada",
    tone: "blue",
    icon: UsersIcon,
  },
  {
    href: "/panel/pagopar",
    label: "Transacciones Pagopar",
    description: "Consultá pagos, referencias y el resultado de cada operación.",
    status: "API conectada",
    tone: "green",
    icon: ReceiptIcon,
  },
] as const;

export default async function PanelPage() {
  const user = await getStaffUser();

  return (
    <div className={styles.page}>
      <section className={styles.welcome}>
        <div>
          <span className={styles.eyebrow}>Resumen general</span>
          <h1>Hola, {user.username}</h1>
          <p>Todo lo que necesitás para operar Teklease, en un solo lugar.</p>
        </div>
        <div className={styles.status}>
          <span />
          <div>
            <strong>Sesión segura</strong>
            <small>Acceso interno verificado</small>
          </div>
        </div>
      </section>

      <section aria-labelledby="modules-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span>OPERACIONES</span>
            <h2 id="modules-heading">Módulos del portal</h2>
          </div>
          <p>Seleccioná un módulo para comenzar.</p>
        </div>

        <div className={styles.moduleGrid}>
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link className={styles.moduleCard} href={module.href} key={module.href}>
                <div className={`${styles.moduleIcon} ${styles[`moduleIcon--${module.tone}`]}`}>
                  <Icon />
                </div>
                <span className={styles.moduleStatus}>
                  <i /> {module.status}
                </span>
                <h3>{module.label}</h3>
                <p>{module.description}</p>
                <span className={styles.moduleLink}>
                  Abrir módulo <ChevronRightIcon />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.activityCard}>
          <div className={styles.cardHeading}>
            <div>
              <span>ACTIVIDAD</span>
              <h2>Últimos movimientos</h2>
            </div>
            <span className={styles.neutralBadge}>Sincronización pendiente</span>
          </div>
          <div className={styles.emptyState}>
            <span className={styles.emptyMark}><i /><i /><i /></span>
            <strong>Todavía no hay actividad para mostrar</strong>
            <p>Los movimientos aparecerán cuando los módulos de datos estén conectados.</p>
          </div>
        </article>

        <aside className={styles.helpCard}>
          <span className={styles.helpKicker}>ACCESO RÁPIDO</span>
          <h2>Gestión de dispositivos</h2>
          <p>Buscá equipos por IMEI o Device ID y gestioná su estado desde el módulo MDM.</p>
          <Link href="/panel/dispositivos">
            Ir a control de equipos <ChevronRightIcon />
          </Link>
          <div className={styles.helpDecoration} aria-hidden="true">
            <DeviceIcon />
          </div>
        </aside>
      </section>
    </div>
  );
}
