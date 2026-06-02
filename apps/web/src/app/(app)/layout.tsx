import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";

// Defense in depth on top of the proxy middleware:
//   1. Belt-and-suspenders session check (Server Components can run in edge
//      cases where middleware hasn't fired).
//   2. Onboarding gate: a logged-in user with zero memberships hasn't
//      finished setup and would land on an empty dashboard. Push them
//      through /onboarding instead.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if ((count ?? 0) === 0) {
    redirect("/onboarding");
  }

  return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">{children}</div>;
}
