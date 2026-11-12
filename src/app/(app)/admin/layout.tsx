import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "./admin-tabs";

// Every admin page checks the role on the server. The database checks it again
// (row level security), so hiding a link is never the only protection.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <AdminTabs />
      {children}
    </div>
  );
}
