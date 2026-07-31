const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

export function getBackendUrl(path: string): string {
  const baseUrl = process.env.BACKEND_URL ?? DEFAULT_BACKEND_URL;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export async function readBackendJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return {
      status: "error",
      message: "El servicio de acceso no está disponible en este momento.",
    };
  }

  return response.json();
}

export function backendUnavailableResponse() {
  return Response.json(
    {
      status: "error",
      message:
        "No pudimos conectar con el servicio de acceso. Intentá nuevamente en unos minutos.",
    },
    { status: 503 },
  );
}
