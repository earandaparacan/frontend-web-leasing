import type { Metadata } from "next";
import { UserStatusPill, UsersDataView } from "@/features/workspace/users-data-view";
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
    <UsersDataView
      rows={data.results.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        type: <UserStatusPill label={user.user_type_label} tone={user.user_type === "staff" ? "info" : "neutral"} />,
        groups: user.groups.length ? user.groups.join(", ") : "Sin grupo",
        status: <UserStatusPill label={user.is_active ? "Activo" : "Inactivo"} tone={user.is_active ? "good" : "neutral"} />,
        lastAccess: formatStaffDate(user.last_login),
      }))}
      pagination={data.pagination}
      search={search}
      type={type}
      error={data.error}
    />
  );
}
