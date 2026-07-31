import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/features/auth/logout-button";
import { getBackendUrl } from "@/lib/backend";

export default async function PanelPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("teklease_staff_session")?.value;

  if (!session) {
    redirect("/");
  }

  let user: { username: string; groups: string[] } | undefined;

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
    <main className="panel-placeholder">
      <header>
        <Link className="wordmark" href="/" aria-label="Teklease, inicio">
          teklease<span>.</span>
        </Link>
        <LogoutButton />
      </header>

      <section>
        <span className="panel-placeholder__icon">
          <CheckIcon />
        </span>
        <p className="auth-heading__kicker">Sesión administrativa activa</p>
        <h1>Hola, {user.username}.</h1>
        <p>
          Tu acceso fue confirmado para{" "}
          <strong>{user.groups.join(", ")}</strong>. Este espacio queda listo
          para recibir los módulos del panel administrativo.
        </p>
      </section>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
