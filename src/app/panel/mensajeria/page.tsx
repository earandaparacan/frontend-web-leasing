import type { Metadata } from "next";
import { MdmMessaging } from "@/features/mdm/mdm-messaging";
import { hasStaffPermission, requireStaffPermission, STAFF_PERMISSIONS } from "@/lib/staff-session";

export const metadata: Metadata = {
  title: "Mensajería MDM | Teklease",
  description: "Envío seguro de mensajes a dispositivos administrados por el MDM.",
};

export default async function MessagingPage() {
  const user = await requireStaffPermission(STAFF_PERMISSIONS.messages);
  return <MdmMessaging permissions={{
    canSend: hasStaffPermission(user, STAFF_PERMISSIONS.sendMessages),
    canManageTemplates: hasStaffPermission(user, STAFF_PERMISSIONS.messageTemplates),
    canRetry: hasStaffPermission(user, STAFF_PERMISSIONS.retryMessages),
  }} />;
}
