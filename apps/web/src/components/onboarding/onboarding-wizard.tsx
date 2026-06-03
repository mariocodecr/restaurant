"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, MapPin } from "lucide-react";
import {
  CreateOrganizationSchema,
  type CreateOrganizationInput,
} from "@restaurant/shared";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

interface OnboardingWizardProps {
  ownerName: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function OnboardingWizard({ ownerName }: OnboardingWizardProps) {
  const router = useRouter();
  const defaultTimezone = useMemo(detectTimezone, []);
  const [step, setStep] = useState<0 | 1>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [taxId, setTaxId] = useState("");

  const [branchName, setBranchName] = useState("Sucursal principal");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function goToBranchStep(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const partial = CreateOrganizationSchema.pick({
      name: true,
      slug: true,
      currency: true,
      timezone: true,
    }).safeParse({ name: orgName, slug, currency, timezone });

    if (!partial.success) {
      const first = partial.error.issues[0];
      setError(first ? `${first.path.join(".")}: ${first.message}` : "Datos inválidos");
      return;
    }
    setStep(1);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const input: CreateOrganizationInput = {
      name: orgName,
      slug,
      currency,
      timezone,
      taxId: taxId.trim() || undefined,
      firstBranch: {
        name: branchName,
        address: branchAddress.trim() || undefined,
        phone: branchPhone.trim() || undefined,
      },
    };

    const parsed = CreateOrganizationSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first ? `${first.path.join(".")}: ${first.message}` : "Datos inválidos");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Tu sesión expiró. Iniciá sesión de nuevo.");
        router.push("/login");
        return;
      }

      const response = await fetch(`${apiUrl}/organizations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(payload?.message ?? `Error ${response.status} al crear la organización`);
        return;
      }

      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[--cream] sm:text-4xl">
          {ownerName ? `Bienvenido, ${ownerName}` : "Configurá tu restaurante"}
        </h1>
        <p className="text-sm text-[--cream]/60">
          En dos pasos tenés tu primer local listo para operar.
        </p>
        <StepIndicator current={step} />
      </header>

      <GlassCard>
        {step === 0 ? (
          <form onSubmit={goToBranchStep} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="orgName" className="text-[--cream]/85">Nombre del restaurante</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => handleOrgNameChange(e.target.value)}
                placeholder="La Parrilla de Mario"
                required
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug" className="text-[--cream]/85">Identificador único (slug)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="la-parrilla-de-mario"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-[--cream]/45">
                Solo minúsculas, números y guiones. Se autogeneró del nombre — editalo si querés.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-[--cream]/85">Moneda</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  placeholder="USD, CRC, EUR..."
                  maxLength={3}
                  pattern="[A-Z]{3}"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-[--cream]/85">Zona horaria</Label>
                <Input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="America/Costa_Rica"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId" className="text-[--cream]/85">
                Cédula jurídica / Tax ID <span className="text-[--cream]/45">(opcional)</span>
              </Label>
              <Input
                id="taxId"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="3-101-123456"
                disabled={isSubmitting}
              />
            </div>

            {error ? <ErrorBanner message={error} /> : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Siguiente: tu primera sucursal
              <ArrowRight className="size-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="branchName" className="text-[--cream]/85">Nombre de la sucursal</Label>
              <Input
                id="branchName"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Sucursal principal"
                required
                autoFocus
                disabled={isSubmitting}
              />
              <p className="text-xs text-[--cream]/45">
                Después podés agregar más sucursales desde el panel.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branchAddress" className="text-[--cream]/85">
                Dirección <span className="text-[--cream]/45">(opcional)</span>
              </Label>
              <Input
                id="branchAddress"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                placeholder="Av. Central 100, San José"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branchPhone" className="text-[--cream]/85">
                Teléfono <span className="text-[--cream]/45">(opcional)</span>
              </Label>
              <Input
                id="branchPhone"
                type="tel"
                value={branchPhone}
                onChange={(e) => setBranchPhone(e.target.value)}
                placeholder="+506 2222 3333"
                disabled={isSubmitting}
              />
            </div>

            {error ? <ErrorBanner message={error} /> : null}

            <Separator className="bg-[--gold-400]/20" />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto"
                onClick={() => setStep(0)}
                disabled={isSubmitting}
              >
                <ArrowLeft className="size-4" /> Volver
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear mi restaurante"}
                {!isSubmitting && <Check className="size-4" />}
              </Button>
            </div>
          </form>
        )}
      </GlassCard>
    </div>
  );
}

function StepIndicator({ current }: { current: 0 | 1 }) {
  const steps = [
    { label: "Restaurante", icon: Building2 },
    { label: "Sucursal", icon: MapPin },
  ];
  return (
    <ol className="flex items-center justify-center gap-3">
      {steps.map((s, index) => {
        const Icon = s.icon;
        const isActive = current === index;
        const isComplete = current > index;
        return (
          <li key={s.label} className="flex items-center gap-3">
            <div
              className={`flex size-9 items-center justify-center rounded-full border text-sm font-medium transition-all ${
                isComplete
                  ? "border-[--gold-300]/70 bg-[--gold-400]/20 text-[--gold-100] shadow-[0_0_15px_rgba(212,163,92,0.45)]"
                  : isActive
                    ? "border-[--gold-400]/70 text-[--gold-200]"
                    : "border-[--gold-400]/20 text-[--cream]/45"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              {isComplete ? <Check className="size-4" /> : <Icon className="size-4" />}
            </div>
            <span
              className={`text-sm ${
                isActive ? "font-medium text-[--cream]" : "text-[--cream]/45"
              }`}
            >
              {s.label}
            </span>
            {index < steps.length - 1 ? (
              <div className="h-px w-8 bg-[--gold-400]/25" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
    >
      {message}
    </p>
  );
}
