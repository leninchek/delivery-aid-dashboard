"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { AuthProvider, useAuth } from "./auth-provider";

const menuSections = [
  {
    title: "General",
    links: [{ href: "/", label: "Panel de Control" }],
  },
  {
    title: "Catálogos",
    links: [
      { href: "/catalogs", label: "Resumen" },
      { href: "/catalogs/org-levels", label: "Niveles Organizacionales" },
      { href: "/catalogs/aid-types", label: "Tipos de Apoyo" },
      { href: "/catalogs/authorities", label: "Autoridades" },
      { href: "/catalogs/cities", label: "Ciudades" },
      { href: "/catalogs/communities", label: "Comunidades" },
      { href: "/catalogs/routes", label: "Rutas" },
    ],
  },
  {
    title: "Operación",
    links: [
      { href: "/organization/members", label: "Miembros Organizacionales" },
      { href: "/access/app-users", label: "Acceso App" },
      { href: "/push/campaigns", label: "Campañas Push" },
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white p-6 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      } lg:block`}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Entrega de Apoyos
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Back Office</h1>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
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
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-slate-500 hover:text-slate-700"
            >
              ☰
            </button>
            <div>
              <p className="text-sm text-slate-600">
                Semana 1: Base compartida y estructura de módulos
              </p>
              {authError ? <p className="mt-1 text-xs text-rose-600">{authError}</p> : null}
            </div>
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
        <main className="flex-1 p-4 lg:p-8">{children}</main>
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
