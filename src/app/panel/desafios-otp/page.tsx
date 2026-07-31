import type { Metadata } from "next";
import { KeyIcon } from "@/components/icons";
import { StaffDataView, StatusPill } from "@/features/workspace/staff-data-view";
import {
  firstQueryValue,
  formatStaffDate,
  getStaffCollection,
  type OtpChallengeRecord,
} from "@/lib/staff-data";

export const metadata: Metadata = {
  title: "Desafíos OTP | Teklease",
  description: "Gestión de desafíos OTP de Teklease.",
};

const statusOptions = [
  { value: "pending", label: "Pendiente" },
  { value: "verified", label: "Verificado" },
  { value: "locked", label: "Bloqueado" },
  { value: "expired", label: "Vencido" },
  { value: "superseded", label: "Reemplazado" },
  { value: "delivery_failed", label: "Fallo de envío" },
];

function otpTone(status: string) {
  if (status === "verified") return "good" as const;
  if (status === "pending") return "warning" as const;
  if (["locked", "delivery_failed"].includes(status)) return "bad" as const;
  return "neutral" as const;
}

export default async function OtpChallengesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstQueryValue(params.search);
  const status = firstQueryValue(params.status);
  const page = firstQueryValue(params.page);
  const data = await getStaffCollection<OtpChallengeRecord>(
    "/api/v1/staff/otp-challenges",
    { search, status, page },
  );

  return (
    <StaffDataView
      basePath="/panel/desafios-otp"
      eyebrow="SEGURIDAD"
      title="Desafíos OTP"
      description="Revisá solicitudes de validación, su estado y el tiempo disponible para completarlas."
      icon={KeyIcon}
      columns={["Documento", "Cliente Odoo", "Estado", "Intentos", "Creado", "Vencimiento"]}
      rows={data.results.map((challenge) => ({
        id: challenge.id,
        cells: [
          <span key="document"><strong>{challenge.document_hint || "—"}</strong><small>{challenge.phone_hint || "Sin teléfono"}</small></span>,
          challenge.odoo_partner_id ?? "Decoy / sin cliente",
          <StatusPill key="status" label={challenge.status_label} tone={otpTone(challenge.status)} />,
          `${challenge.attempts} / ${challenge.max_attempts}`,
          formatStaffDate(challenge.created_at),
          formatStaffDate(challenge.expires_at),
        ],
      }))}
      pagination={data.pagination}
      search={search}
      searchPlaceholder="Buscar documento, teléfono o partner..."
      filterName="status"
      filterLabel="Estado"
      filterValue={status}
      filterOptions={statusOptions}
      emptyTitle="No hay desafíos OTP"
      emptyDescription="No se encontraron solicitudes con los filtros actuales."
      error={data.error}
    />
  );
}
