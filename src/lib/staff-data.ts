import { cookies } from "next/headers";
import { getBackendUrl, readBackendJson } from "@/lib/backend";

export type Pagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type StaffCollection<T> = {
  results: T[];
  pagination: Pagination;
  error?: string;
};

export type OtpChallengeRecord = {
  id: string;
  document_hint: string;
  odoo_partner_id: number | null;
  phone_hint: string;
  status: string;
  status_label: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  verified_at: string | null;
  created_at: string;
};

export type StaffUserRecord = {
  id: string;
  username: string;
  email: string;
  user_type: string;
  user_type_label: string;
  is_active: boolean;
  groups: string[];
  odoo_partner_id: number | null;
  document_hint: string;
  last_login: string | null;
  created_at: string;
};

export type PagoparTransactionRecord = {
  id: string;
  merchant_order_id: string;
  invoice_name: string;
  odoo_invoice_id: number;
  odoo_partner_id: number;
  amount: string;
  currency: string;
  status: string;
  status_label: string;
  payment_method: string;
  receipt_number: string;
  paid_at: string | null;
  expires_at: string;
  odoo_registered: boolean;
  created_at: string;
  updated_at: string;
};

const emptyPagination: Pagination = {
  page: 1,
  page_size: 20,
  total: 0,
  total_pages: 1,
};

function isCollectionPayload(value: unknown): value is {
  results: unknown[];
  pagination: Pagination;
} {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  const pagination = payload.pagination;
  return (
    Array.isArray(payload.results) &&
    typeof pagination === "object" &&
    pagination !== null &&
    typeof (pagination as Record<string, unknown>).page === "number" &&
    typeof (pagination as Record<string, unknown>).total === "number" &&
    typeof (pagination as Record<string, unknown>).total_pages === "number"
  );
}

export async function getStaffCollection<T>(
  path: string,
  params: Record<string, string | undefined>,
): Promise<StaffCollection<T>> {
  const cookieStore = await cookies();
  const session = cookieStore.get("teklease_staff_session")?.value;
  if (!session) {
    return { results: [], pagination: emptyPagination, error: "Tu sesión expiró." };
  }

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  query.set("page_size", "20");

  try {
    const response = await fetch(getBackendUrl(`${path}?${query}`), {
      headers: { Cookie: `sessionid=${session}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await readBackendJson(response);

    if (!response.ok || !isCollectionPayload(data)) {
      const message =
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : "No se pudieron cargar los datos del módulo.";
      return { results: [], pagination: emptyPagination, error: message };
    }

    return {
      results: data.results as T[],
      pagination: data.pagination,
    };
  } catch {
    return {
      results: [],
      pagination: emptyPagination,
      error: "No pudimos conectar con el backend. Verificá que el servicio esté activo.",
    };
  }
}

export function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function formatStaffDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
