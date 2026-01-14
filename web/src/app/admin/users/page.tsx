import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/layout/AppHeader";
import { UserManagement } from "@/components/admin/UserManagement";

export default async function UsersPage() {
  const session = await auth();

  // Only admins can access
  if (!session?.user || session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-black">
      <AppHeader title="User Management" />
      <UserManagement />
    </div>
  );
}
