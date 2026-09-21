"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloseIcon,
  DashboardIcon,
  DeviceIcon,
  KeyIcon,
  MenuIcon,
  MessageIcon,
  ReceiptIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { LogoutButton } from "@/features/auth/logout-button";
import {
  hasStaffPermission,
  STAFF_PERMISSIONS,
  type StaffUser,
} from "@/lib/staff-permissions";
import styles from "./workspace-navigation.module.css";

const navigation = [
  { href: "/panel", label: "Dashboard", icon: DashboardIcon, exact: true, permission: STAFF_PERMISSIONS.dashboard },
  { href: "/panel/dispositivos", label: "Lock / Unlock", icon: DeviceIcon, exact: false, permission: STAFF_PERMISSIONS.devices },
  { href: "/panel/mensajeria", label: "Mensajería MDM", icon: MessageIcon, exact: false, permission: STAFF_PERMISSIONS.messages },
  { href: "/panel/desafios-otp", label: "Desafíos OTP", icon: KeyIcon, exact: false, permission: STAFF_PERMISSIONS.otpChallenges },
  { href: "/panel/usuarios", label: "Usuarios", icon: UsersIcon, exact: false, permission: STAFF_PERMISSIONS.users },
  { href: "/panel/pagopar", label: "Pagopar transactions", icon: ReceiptIcon, exact: false, permission: STAFF_PERMISSIONS.pagopar },
  { href: "/panel/infonet", label: "Infonet transactions", icon: ReceiptIcon, exact: false, permission: STAFF_PERMISSIONS.infonet },
  { href: "/panel/odoo-payment-events", label: "Odoo payment events", icon: ReceiptIcon, exact: false, permission: STAFF_PERMISSIONS.odooPaymentEvents },
  { href: "/panel/estado-cobranzas", label: "Estado de cobranzas", icon: ReceiptIcon, exact: false, permission: STAFF_PERMISSIONS.collectionCases },
  { href: "/panel/imei-duplicados", label: "IMEI duplicados", icon: ShieldIcon, exact: false, permission: STAFF_PERMISSIONS.imeiConflicts },
] as const;

export function WorkspaceNavigation({ user }: { user: StaffUser }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className={styles.mobileHeader}>
        <Link className="wordmark" href="/panel" aria-label="Teklease, dashboard">
          teklease<span>.</span>
        </Link>
        <button
          className={styles.menuButton}
          type="button"
          aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {isOpen ? (
        <button
          className={styles.backdrop}
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <Link className="wordmark wordmark--light" href="/panel" aria-label="Teklease, dashboard">
            teklease<span>.</span>
          </Link>
          <span>ADMIN PORTAL</span>
        </div>

        <nav className={styles.navigation} aria-label="Navegación principal">
          <span className={styles.navLabel}>MENÚ PRINCIPAL</span>
          {navigation.filter((item) => hasStaffPermission(user, item.permission)).map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                className={active ? styles.active : undefined}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setIsOpen(false)}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.securityNote}>
            <ShieldIcon />
            <div>
              <strong>Entorno seguro</strong>
              <span>Conexión protegida</span>
            </div>
          </div>
          <Link
            className={styles.user}
            href="/panel/mi-cuenta"
            title={user.username}
            aria-label="Abrir mi cuenta"
            aria-current={pathname === "/panel/mi-cuenta" ? "page" : undefined}
            onClick={() => setIsOpen(false)}
          >
            <span className={styles.avatar}>{user.username.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.username}</strong>
              <small>{user.is_superuser ? "Administrador" : user.groups[0]}</small>
            </div>
          </Link>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
