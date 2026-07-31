import type { Metadata } from "next";
import { DeviceManagement } from "@/features/mdm/device-management";

export const metadata: Metadata = {
  title: "Control de equipos | Teklease",
  description: "Consulta, bloqueo y desbloqueo seguro de equipos Teklease.",
};

export default function DevicesPage() {
  return <DeviceManagement />;
}
