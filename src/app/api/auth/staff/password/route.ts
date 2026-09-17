import { NextRequest, NextResponse } from "next/server";
import {
  backendCookieValue,
  backendUnavailableResponse,
  getBackendUrl,
  readBackendJson,
} from "@/lib/backend";

type PasswordPayload = {
  current_password?: unknown;
  new_password?: unknown;
  confirm_password?: unknown;
};

const SESSION_MAX_AGE = 14 * 24 * 60 * 60;

function clearAuthCookies(response: NextResponse) {
  response.cookies.delete("teklease_staff_session");
  response.cookies.delete("teklease_staff_csrf");
  response.cookies.delete("teklease_staff_persistent");
}

export async function POST(request: NextRequest) {
  const session = request.cookies.get("teklease_staff_session")?.value;
  const csrf = request.cookies.get("teklease_staff_csrf")?.value;

  if (!session || !csrf) {
    const response = NextResponse.json(
      {
        status: "error",
        message: "Tu sesión expiró. Iniciá sesión nuevamente.",
      },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
  }

  try {
    const payload = (await request.json()) as PasswordPayload;
    if (
      typeof payload.current_password !== "string" ||
      typeof payload.new_password !== "string" ||
      typeof payload.confirm_password !== "string"
    ) {
      return NextResponse.json(
        { status: "error", message: "Completá todos los campos." },
        { status: 400 },
      );
    }

    const backendResponse = await fetch(
      getBackendUrl("/api/v1/auth/staff/password"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sessionid=${session}; csrftoken=${csrf}`,
          "X-CSRFToken": csrf,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await readBackendJson(backendResponse);
    const response = NextResponse.json(data, {
      status: backendResponse.status,
    });

    if (!backendResponse.ok) {
      if (backendResponse.status === 401 || backendResponse.status === 403) {
        clearAuthCookies(response);
      }
      return response;
    }

    const rotatedSession = backendCookieValue(
      backendResponse.headers.get("set-cookie"),
      "sessionid",
    );
    if (!rotatedSession) {
      const loginResponse = NextResponse.json(
        {
          status: "success",
          message:
            "Tu contraseña fue actualizada. Iniciá sesión nuevamente para continuar.",
          requires_login: true,
        },
        { status: 200 },
      );
      clearAuthCookies(loginResponse);
      return loginResponse;
    }

    const secure = process.env.AUTH_COOKIE_SECURE !== "false";
    const persistent =
      request.cookies.get("teklease_staff_persistent")?.value === "1";
    const common = {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
      ...(persistent ? { maxAge: SESSION_MAX_AGE } : {}),
    };
    response.cookies.set("teklease_staff_session", rotatedSession, common);

    return response;
  } catch {
    return backendUnavailableResponse();
  }
}
