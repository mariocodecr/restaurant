import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organization_id, branch_id, role")
    .eq("is_active", true);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Bienvenido, {user?.email}
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Tus memberships activas (visibles vía RLS):
      </p>
      <pre className="mt-6 overflow-auto rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        {JSON.stringify(memberships ?? [], null, 2)}
      </pre>
    </main>
  );
}
