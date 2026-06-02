"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

export function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setNotice(
          "Te enviamos un email para confirmar tu cuenta. Revisalo y volvé a iniciar sesión.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <GlassCard>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Creá tu cuenta
          </h1>
          <p className="text-sm text-white/60">
            Empezá a gestionar tu restaurante en minutos
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-white/80">
              Nombre completo
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
              <Input
                id="fullName"
                type="text"
                placeholder="Mario Araya"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10"
                required
                autoComplete="name"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
              <Input
                id="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
                disabled={isLoading}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              {error}
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-200"
            >
              {notice}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <Separator className="bg-white/10" />

        <p className="text-center text-sm text-white/60">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-sky-300 hover:text-sky-200">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </GlassCard>
  );
}
