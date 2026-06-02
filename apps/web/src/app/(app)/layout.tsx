import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";

// Defense in depth: the middleware already redirects unauthenticated requests,
// but Server Components could be rendered in edge cases (e.g. revalidate paths)
// where middleware hasn't run. Belt + suspenders.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">{children}</div>;
}
