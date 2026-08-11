import { cookies } from "next/headers";
import { getBackendUrl, readBackendJson } from "@/lib/backend";

const DEFAULT_QUERY_PATH = "/api/v1/mdm/devices/query";
const DEFAULT_WITHOUT_REPORT_PATH = "/api/v1/mdm/devices/without-report";
const DEFAULT_ACTION_PATH = "/api/v1/mdm/devices/action";
const DEFAULT_GROUPS_PATH = "/api/v1/mdm/groups";
const DEFAULT_BRANCHES_PATH = "/api/v1/mdm/branches";
const DEFAULT_MESSAGE_PATH = "/api/v1/mdm/messages";
const DEFAULT_MESSAGE_JOBS_PATH = "/api/v1/mdm/message-jobs";
const DEFAULT_ACTION_JOBS_PATH = "/api/v1/mdm/action-jobs";
const DEFAULT_CAPABILITIES_PATH = "/api/v1/mdm/capabilities";
const DEFAULT_LOCK_TEMPLATES_PATH = "/api/v1/mdm/lock-templates";
const DEFAULT_MESSAGE_TEMPLATES_PATH = "/api/v1/mdm/message-templates";
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

export function getMdmWithoutReportUrl(period: "24h" | "7d") {
  return getBackendUrl(`${DEFAULT_WITHOUT_REPORT_PATH}?period=${period}`);
}

export function getMdmActionUrl() {
  const fallback = process.env.MDM_BACKEND_URL ? LEGACY_ACTION_PATH : DEFAULT_ACTION_PATH;
  return getMdmBackendUrl(configuredPath(process.env.MDM_ACTION_PATH, fallback));
}

export function getMdmMessageUrl() {
  return getBackendUrl(DEFAULT_MESSAGE_PATH);
}

export function getMdmMessageJobsUrl(
  jobId?: string,
  action?: "retry-failures" | "rerun",
) {
  if (!jobId) return getBackendUrl(DEFAULT_MESSAGE_JOBS_PATH);

  const jobPath = `${DEFAULT_MESSAGE_JOBS_PATH}/${encodeURIComponent(jobId)}`;
  return getBackendUrl(action ? `${jobPath}/${action}` : jobPath);
}

export function getMdmActionJobsUrl(
  jobId?: string,
  action?: "events" | "retry-failures" | "rerun",
) {
  if (!jobId) return getBackendUrl(DEFAULT_ACTION_JOBS_PATH);

  const jobPath = `${DEFAULT_ACTION_JOBS_PATH}/${encodeURIComponent(jobId)}`;
  return getBackendUrl(action ? `${jobPath}/${action}` : jobPath);
}

export function getMdmCapabilitiesUrl() {
  return getBackendUrl(DEFAULT_CAPABILITIES_PATH);
}

export function getMdmGroupsUrl() {
  return getBackendUrl(DEFAULT_GROUPS_PATH);
}

export function getMdmBranchesUrl() {
  return getBackendUrl(DEFAULT_BRANCHES_PATH);
}

export function getMdmLockTemplatesUrl() {
  return getBackendUrl(DEFAULT_LOCK_TEMPLATES_PATH);
}

export function getMdmMessageTemplatesUrl() {
  return getBackendUrl(DEFAULT_MESSAGE_TEMPLATES_PATH);
}

export async function forwardMdmRequest(
  url: string,
  body: unknown = undefined,
  timeoutMilliseconds = 30_000,
  method: "GET" | "POST" = "POST",
  additionalHeaders: Readonly<Record<string, string>> = {},
) {
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
      method,
      headers: {
        "Content-Type": "application/json",
        ...additionalHeaders,
        Cookie: `sessionid=${session}${csrf ? `; csrftoken=${csrf}` : ""}`,
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
        ...(basicAuthorization ? { Authorization: basicAuthorization } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMilliseconds),
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
