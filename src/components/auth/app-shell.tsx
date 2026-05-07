"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { AuthProvider, useAuth } from "./auth-provider";

const menuSections = [
  {
    title: "General",
    links: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Catalogos",
    links: [
      { href: "/catalogs", label: "Resumen" },
      { href: "/catalogs/org-levels", label: "Org Levels" },
      { href: "/catalogs/aid-types", label: "Aid Types" },
      { href: "/catalogs/authorities", label: "Authorities" },
      { href: "/catalogs/cities", label: "Cities" },
      { href: "/catalogs/communities", label: "Communities" },
      { href: "/catalogs/routes", label: "Routes" },
    ],
  },
  {
    title: "Operacion",
    links: [
      { href: "/organization/members", label: "Org Members" },
      { href: "/access/app-users", label: "App Access" },
      { href: "/push/campaigns", label: "Push Campaigns" },
    ],
  },
];

function LoginView({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    authError,
    isConfigured,
    isLoading,
    missingEnvVars,
    sessionUser,
    signOutCurrentUser,
  } = useAuth();

  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (!isConfigured || isLoading) {
      return;
    }

    if (!sessionUser && !isLoginRoute) {
      router.replace("/login");
      return;
    }

    if (sessionUser && isLoginRoute) {
      router.replace("/");
    }
  }, [isConfigured, isLoading, isLoginRoute, router, sessionUser]);

  if (!isConfigured) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-3xl">
          <MissingConfigNotice missingVars={missingEnvVars} />
        </div>
      </main>
    );
  }

  if (isLoginRoute) {
    return <LoginView>{children}</LoginView>;
  }

  if (isLoading || !sessionUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600">
          Validando sesion...
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
      <aside className="w-72 border-r border-slate-200 bg-white p-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Delivery Aid
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Back Office</h1>
        </div>

        <nav className="space-y-6">
          {menuSections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.links.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
          <div>
            <p className="text-sm text-slate-600">
              Semana 1: Base compartida y estructura de modulos
            </p>
            {authError ? <p className="mt-1 text-xs text-rose-600">{authError}</p> : null}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{sessionUser.name}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {sessionUser.backofficeRole}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOutCurrentUser()}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cerrar sesion
            </button>
          </div>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthProvider>
  );
}
