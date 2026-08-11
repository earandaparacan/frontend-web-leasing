import type { Metadata } from "next";
import { UnreportedDevices } from "@/features/mdm/unreported-devices";

export const metadata: Metadata = {
  title: "Equipos sin reporte | Teklease",
  description: "Detalle de equipos MDM sin comunicación reciente.",
};

export default function UnreportedDevicesPage() {
  return <UnreportedDevices />;
}
