import type { Metadata } from "next";
import { UsersIcon } from "@/components/icons";
import { StaffDataView, StatusPill } from "@/features/workspace/staff-data-view";
import {
  firstQueryValue,
  formatStaffDate,
  getStaffCollection,
  type StaffUserRecord,
} from "@/lib/staff-data";

export const metadata: Metadata = {
  title: "Usuarios | Teklease",
  description: "Gestión de usuarios de Teklease.",
};

const typeOptions = [
  { value: "customer", label: "Cliente" },
  { value: "staff", label: "Usuario interno" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstQueryValue(params.search);
  const type = firstQueryValue(params.type);
  const page = firstQueryValue(params.page);
  const data = await getStaffCollection<StaffUserRecord>("/api/v1/staff/users", {
    search,
    type,
    page,
  });

  return (
    <StaffDataView
      basePath="/panel/usuarios"
      eyebrow="ADMINISTRACIÓN"
      title="Usuarios"
      description="Consultá cuentas, perfiles de acceso y el estado de los usuarios del ecosistema Teklease."
      icon={UsersIcon}
      columns={["Usuario", "Tipo", "Referencia", "Grupos", "Estado", "Último acceso"]}
      rows={data.results.map((user) => ({
        id: user.id,
        cells: [
          <span key="user"><strong>{user.username}</strong><small>{user.email || "Sin email"}</small></span>,
          <StatusPill key="type" label={user.user_type_label} tone={user.user_type === "staff" ? "info" : "neutral"} />,
          <span key="reference"><strong>{user.odoo_partner_id ?? "—"}</strong><small>{user.document_hint || "Sin documento"}</small></span>,
          user.groups.length ? user.groups.join(", ") : "Sin grupo",
          <StatusPill key="active" label={user.is_active ? "Activo" : "Inactivo"} tone={user.is_active ? "good" : "neutral"} />,
          formatStaffDate(user.last_login),
        ],
      }))}
      pagination={data.pagination}
      search={search}
      searchPlaceholder="Buscar usuario, email, documento o partner..."
      filterName="type"
      filterLabel="Tipo"
      filterValue={type}
      filterOptions={typeOptions}
      emptyTitle="No hay usuarios"
      emptyDescription="No se encontraron cuentas con los filtros actuales."
      error={data.error}
    />
  );
}
