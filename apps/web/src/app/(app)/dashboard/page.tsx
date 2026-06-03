import { GlassCard } from "@/components/ui/glass-card";
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[--gold-400]/80">Panel principal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[--cream] sm:text-4xl">
          Bienvenido, {user?.email}
        </h1>
        <p className="text-sm text-[--cream]/60">
          Tus memberships activas (visibles vía RLS):
        </p>
      </header>

      <GlassCard>
        <pre className="overflow-auto text-sm text-[--gold-100]/90">
          {JSON.stringify(memberships ?? [], null, 2)}
        </pre>
      </GlassCard>
    </main>
  );
}
