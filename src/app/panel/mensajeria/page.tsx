import type { Metadata } from "next";
import { MdmMessaging } from "@/features/mdm/mdm-messaging";

export const metadata: Metadata = {
  title: "Mensajería MDM | Teklease",
  description: "Envío seguro de mensajes a dispositivos administrados por Headwind MDM.",
};

export default function MessagingPage() {
  return <MdmMessaging />;
}
