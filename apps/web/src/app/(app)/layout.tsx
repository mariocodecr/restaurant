import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import type { OrgOption } from "@/components/layout/org-switcher";
import { createClient } from "@/lib/supabase/server";

// Defense in depth on top of the proxy middleware:
//   1. Belt-and-suspenders session check.
//   2. Onboarding gate: zero memberships ⇒ /onboarding.
//   3. Fetch the user's orgs once here so AppShell + downstream pages
//      don't each round-trip Supabase.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rawMemberships } = await supabase
    .from("memberships")
    .select("organization_id, role, organizations:organizations(id, name)")
    .eq("is_active", true);

  if (!rawMemberships || rawMemberships.length === 0) {
    redirect("/onboarding");
  }

  // Flatten and dedupe by org (a user with both owner and waiter rows on
  // the same org should still appear once; pick the highest-privilege role).
  const ROLE_PRIORITY: Record<string, number> = {
    owner: 4,
    admin: 3,
    waiter: 2,
    kitchen: 1,
  };
  const byOrg = new Map<string, OrgOption>();
  for (const m of rawMemberships) {
    const org = m.organizations;
    if (!org) continue;
    const existing = byOrg.get(org.id);
    if (!existing || (ROLE_PRIORITY[m.role] ?? 0) > (ROLE_PRIORITY[existing.role] ?? 0)) {
      byOrg.set(org.id, { id: org.id, name: org.name, role: m.role });
    }
  }
  const orgs = Array.from(byOrg.values());
  const currentOrgId = orgs[0]!.id; // TODO: persist active-org selection per user

  const fullName =
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null) ?? null;

  return (
    <div className="min-h-screen">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppTopbar
          orgs={orgs}
          currentOrgId={currentOrgId}
          user={{ email: user.email ?? "", fullName }}
        />
        <main>{children}</main>
      </div>
    </div>
  );
}
