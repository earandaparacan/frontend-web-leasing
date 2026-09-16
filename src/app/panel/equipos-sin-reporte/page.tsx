import type { Metadata } from "next";
import { UnreportedDevices } from "@/features/mdm/unreported-devices";
import { requireStaffPermission, STAFF_PERMISSIONS } from "@/lib/staff-session";

export const metadata: Metadata = {
  title: "Equipos sin reporte | Teklease",
  description: "Detalle de equipos MDM sin comunicación reciente.",
};

export default async function UnreportedDevicesPage() {
  await requireStaffPermission(STAFF_PERMISSIONS.devices);
  return <UnreportedDevices />;
}
