import { NextResponse } from "next/server";
import {
  backendUnavailableResponse,
  getBackendUrl,
  readBackendJson,
} from "@/lib/backend";

type LoginPayload = {
  username?: unknown;
  password?: unknown;
  remember?: unknown;
};

function cookieValue(setCookie: string | null, name: string): string | null {
  const match = setCookie?.match(new RegExp(`(?:^|,\\s*)${name}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LoginPayload;
    const clientIp = request.headers.get("x-real-ip");

    if (
      typeof payload.username !== "string" ||
      typeof payload.password !== "string"
    ) {
      return NextResponse.json(
        { status: "error", message: "Completá tu usuario y contraseña." },
        { status: 400 },
      );
    }

    const csrfResponse = await fetch(getBackendUrl("/api/v1/auth/csrf"), {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const csrfData = (await readBackendJson(csrfResponse)) as {
      csrf_token?: string;
    };
    const csrfCookie = cookieValue(
      csrfResponse.headers.get("set-cookie"),
      "csrftoken",
    );

    if (!csrfResponse.ok || !csrfCookie || !csrfData.csrf_token) {
      return backendUnavailableResponse();
    }

    const loginResponse = await fetch(
      getBackendUrl("/api/v1/auth/staff/login"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `csrftoken=${csrfCookie}`,
          "X-CSRFToken": csrfData.csrf_token,
          ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
        },
        body: JSON.stringify({
          username: payload.username.trim(),
          password: payload.password,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await readBackendJson(loginResponse);

    if (!loginResponse.ok) {
      return NextResponse.json(data, { status: loginResponse.status });
    }

    const setCookie = loginResponse.headers.get("set-cookie");
    const sessionCookie = cookieValue(setCookie, "sessionid");
    const rotatedCsrfCookie =
      cookieValue(setCookie, "csrftoken") ?? csrfCookie;

    if (!sessionCookie) {
      return backendUnavailableResponse();
    }

    const result = NextResponse.json(data);
    const secure = process.env.AUTH_COOKIE_SECURE !== "false";
    const persistent = payload.remember === true;
    const common = {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
      ...(persistent ? { maxAge: 14 * 24 * 60 * 60 } : {}),
    };

    result.cookies.set("teklease_staff_session", sessionCookie, common);
    result.cookies.set("teklease_staff_csrf", rotatedCsrfCookie, common);

    return result;
  } catch {
    return backendUnavailableResponse();
  }
}
