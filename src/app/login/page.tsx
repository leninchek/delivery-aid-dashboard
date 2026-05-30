"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { useAuth } from "@/components/auth/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const {
    authError,
    isConfigured,
    isLoading,
    missingEnvVars,
    sessionUser,
    signInWithEmail,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sessionUser && !isLoading) {
      router.replace("/");
    }
  }, [isLoading, router, sessionUser]);

  if (!isConfigured) {
    return (
      <MissingConfigNotice
        missingVars={missingEnvVars}
        title="Configura Firebase para iniciar sesion"
      />
    );
  }


  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await signInWithEmail(email, password);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No fue posible iniciar sesion."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Entrega de Apoyos
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Acceso exclusivo para usuarios Back Office activos.
        </p>
      </div>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Correo electrónico</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-0 transition focus:border-slate-900"
            placeholder="admin@entregadeapoyos.com"
            required
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-0 transition focus:border-slate-900"
            placeholder="••••••••"
            required
          />
        </label>

        {submitError || authError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {submitError || authError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Ingresando..." : "Entrar"}
        </button>
      </form>
    </section>
  );
}
