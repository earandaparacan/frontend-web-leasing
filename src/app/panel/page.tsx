import { cookies } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeviceManagement } from "@/features/mdm/device-management";
import { LogoutButton } from "@/features/auth/logout-button";
import { getBackendUrl } from "@/lib/backend";

type StaffUser = {
  username: string;
  groups: string[];
};

export const metadata: Metadata = {
  title: "Control de equipos | Teklease",
  description: "Consulta, bloqueo y desbloqueo seguro de equipos Teklease.",
};

export default async function PanelPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("teklease_staff_session")?.value;

  if (!session) {
    redirect("/");
  }

  let user: StaffUser | undefined;

  try {
    const response = await fetch(getBackendUrl("/api/v1/me"), {
      headers: { Cookie: `sessionid=${session}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json()) as {
      user?: { username: string; user_type: string; groups: string[] };
    };
    const allowedGroups = new Set([
      "Atención al cliente",
      "Cobranzas",
      "Gerencia",
      "Soporte técnico",
    ]);

    if (
      !response.ok ||
      data.user?.user_type !== "staff" ||
      !data.user.groups.some((group) => allowedGroups.has(group))
    ) {
      redirect("/");
    }

    user = data.user;
  } catch {
    redirect("/");
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div className="workspace-header__identity">
          <Link className="wordmark" href="/panel" aria-label="Teklease, panel">
            teklease<span>.</span>
          </Link>
          <span className="workspace-header__divider" aria-hidden="true" />
          <div>
            <span className="workspace-header__area">Operaciones</span>
            <strong>Control de equipos</strong>
          </div>
        </div>

        <div className="workspace-header__session">
          <div className="workspace-header__user">
            <span>{user.username.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.username}</strong>
              <small>{user.groups[0]}</small>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <DeviceManagement />
    </main>
  );
}
