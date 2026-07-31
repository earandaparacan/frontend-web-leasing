import { cookies } from "next/headers";
import { cache } from "react";
import { getBackendUrl } from "@/lib/backend";

export type StaffUser = {
  username: string;
  groups: string[];
};

const allowedGroups = new Set([
  "Atención al cliente",
  "Cobranzas",
  "Gerencia",
  "Soporte técnico",
]);

export const getStaffUser = cache(async (): Promise<StaffUser> => {
  const cookieStore = await cookies();
  const session = cookieStore.get("teklease_staff_session")?.value;

  if (!session) throw new Error("Missing staff session");

  const response = await fetch(getBackendUrl("/api/v1/me"), {
    headers: { Cookie: `sessionid=${session}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json()) as {
    user?: { username: string; user_type: string; groups: string[] };
  };

  if (
    !response.ok ||
    data.user?.user_type !== "staff" ||
    !data.user.groups.some((group) => allowedGroups.has(group))
  ) {
    throw new Error("Unauthorized staff session");
  }

  return data.user;
});
