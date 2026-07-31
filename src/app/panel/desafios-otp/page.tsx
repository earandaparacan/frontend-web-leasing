import type { Metadata } from "next";
import { KeyIcon } from "@/components/icons";
import { ModulePlaceholder } from "@/features/workspace/module-placeholder";

export const metadata: Metadata = {
  title: "Desafíos OTP | Teklease",
  description: "Gestión de desafíos OTP de Teklease.",
};

export default function OtpChallengesPage() {
  return (
    <ModulePlaceholder
      eyebrow="SEGURIDAD"
      title="Desafíos OTP"
      description="Revisá solicitudes de validación, su estado y el tiempo disponible para completarlas."
      emptyTitle="No hay desafíos OTP disponibles"
      emptyDescription="La estructura del módulo está lista. Los registros aparecerán cuando se conecte el endpoint de desafíos OTP."
      icon={KeyIcon}
      columns={["Usuario", "Canal", "Estado", "Vencimiento"]}
    />
  );
}
