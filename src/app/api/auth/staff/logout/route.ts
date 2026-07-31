import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

export async function POST(request: NextRequest) {
  const session = request.cookies.get("teklease_staff_session")?.value;
  const csrf = request.cookies.get("teklease_staff_csrf")?.value;

  if (session && csrf) {
    try {
      await fetch(getBackendUrl("/api/v1/auth/staff/logout"), {
        method: "POST",
        headers: {
          Cookie: `sessionid=${session}; csrftoken=${csrf}`,
          "X-CSRFToken": csrf,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Local cookies are still cleared when the backend is unavailable.
    }
  }

  const response = NextResponse.json({ status: "success" });
  response.cookies.delete("teklease_staff_session");
  response.cookies.delete("teklease_staff_csrf");
  return response;
}
