import { redirect } from "next/navigation";
import { WorkspaceNavigation } from "@/features/workspace/workspace-navigation";
import { getStaffUser } from "@/lib/staff-session";

export default async function PanelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let user;

  try {
    user = await getStaffUser();
  } catch {
    redirect("/");
  }

  return (
    <div className="workspace-layout">
      <WorkspaceNavigation user={user} />
      <main className="workspace-content">{children}</main>
    </div>
  );
}
