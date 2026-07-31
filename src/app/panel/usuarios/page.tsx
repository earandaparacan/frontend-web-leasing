import type { Metadata } from "next";
import { UsersIcon } from "@/components/icons";
import { ModulePlaceholder } from "@/features/workspace/module-placeholder";

export const metadata: Metadata = {
  title: "Usuarios | Teklease",
  description: "Gestión de usuarios de Teklease.",
};

export default function UsersPage() {
  return (
    <ModulePlaceholder
      eyebrow="ADMINISTRACIÓN"
      title="Usuarios"
      description="Consultá cuentas, perfiles de acceso y el estado de los usuarios del ecosistema Teklease."
      emptyTitle="No hay usuarios para mostrar"
      emptyDescription="La estructura del módulo está lista. Los usuarios aparecerán cuando se conecte su fuente de datos."
      icon={UsersIcon}
      columns={["Usuario", "Documento", "Estado", "Último acceso"]}
    />
  );
}
