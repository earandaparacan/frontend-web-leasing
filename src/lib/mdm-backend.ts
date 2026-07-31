import { cookies } from "next/headers";
import { getBackendUrl, readBackendJson } from "@/lib/backend";

const DEFAULT_QUERY_PATH = "/api/v1/mdm/devices/query";
const DEFAULT_ACTION_PATH = "/api/v1/mdm/devices/action";
const DEFAULT_MESSAGE_PATH = "/api/v1/mdm/messages";
const LEGACY_QUERY_PATH = "/api/query";
const LEGACY_ACTION_PATH = "/api/action";

function configuredPath(value: string | undefined, fallback: string) {
  return value?.startsWith("/") ? value : fallback;
}

function getMdmBackendUrl(path: string) {
  const baseUrl = process.env.MDM_BACKEND_URL;
  if (!baseUrl) return getBackendUrl(path);
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function getMdmQueryUrl() {
  const fallback = process.env.MDM_BACKEND_URL ? LEGACY_QUERY_PATH : DEFAULT_QUERY_PATH;
  return getMdmBackendUrl(configuredPath(process.env.MDM_QUERY_PATH, fallback));
}

export function getMdmActionUrl() {
  const fallback = process.env.MDM_BACKEND_URL ? LEGACY_ACTION_PATH : DEFAULT_ACTION_PATH;
  return getMdmBackendUrl(configuredPath(process.env.MDM_ACTION_PATH, fallback));
}

export function getMdmMessageUrl() {
  return getBackendUrl(DEFAULT_MESSAGE_PATH);
}

export async function forwardMdmRequest(url: string, body: unknown) {
  const cookieStore = await cookies();
  const session = cookieStore.get("teklease_staff_session")?.value;
  const csrf = cookieStore.get("teklease_staff_csrf")?.value;

  if (!session) {
    return Response.json(
      { status: "error", message: "Tu sesión expiró. Iniciá sesión nuevamente." },
      { status: 401 },
    );
  }

  try {
    const mdmUser = process.env.MDM_BACKEND_USER;
    const mdmPassword = process.env.MDM_BACKEND_PASSWORD;
    const basicAuthorization =
      mdmUser && mdmPassword
        ? `Basic ${Buffer.from(`${mdmUser}:${mdmPassword}`, "utf8").toString("base64")}`
        : undefined;
    const backendResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `sessionid=${session}${csrf ? `; csrftoken=${csrf}` : ""}`,
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
        ...(basicAuthorization ? { Authorization: basicAuthorization } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = await readBackendJson(backendResponse);

    return Response.json(data, { status: backendResponse.status });
  } catch {
    return Response.json(
      {
        status: "error",
        message: "No pudimos conectar con el servicio MDM. Intentá nuevamente.",
      },
      { status: 503 },
    );
  }
}
