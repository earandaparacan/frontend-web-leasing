import type { Metadata } from "next";
import { DeviceManagement } from "@/features/mdm/device-management";
import { hasStaffPermission, requireStaffPermission, STAFF_PERMISSIONS } from "@/lib/staff-session";

export const metadata: Metadata = {
  title: "Control de equipos | Teklease",
  description: "Consulta, bloqueo y desbloqueo seguro de equipos Teklease.",
};

export default async function DevicesPage() {
  const user = await requireStaffPermission(STAFF_PERMISSIONS.devices);
  return <DeviceManagement permissions={{
    canLock: hasStaffPermission(user, STAFF_PERMISSIONS.lock),
    canUnlock: hasStaffPermission(user, STAFF_PERMISSIONS.unlock),
    canManageTemplates: hasStaffPermission(user, STAFF_PERMISSIONS.lockTemplates),
    canRetry: hasStaffPermission(user, STAFF_PERMISSIONS.retryActions),
  }} />;
}
