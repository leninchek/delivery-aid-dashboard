"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { Toaster } from "@/components/ui/toast";
import { AuthProvider, useAuth } from "./auth-provider";

const menuSections = [
  {
    title: "Reportes",
    links: [
      { href: "/reports/charts",      label: "Panel de Control"        },
      { href: "/reports/deliveries",  label: "Entregas"                },
      { href: "/reports/activists",   label: "Actividad por Activista" },
      { href: "/reports/promoted",    label: "Promovidos"              },
      { href: "/reports/communities", label: "Cobertura por Comunidad"    },
      { href: "/reports/authorities", label: "Autoridades por Comunidad" },
      { href: "/reports/branch",      label: "Rama Jerárquica"           },
    ],
  },
  {
    title: "Operación",
    links: [
      { href: "/catalogs/org-levels",  label: "Niveles Organizacionales" },
      { href: "/access/app-users",      label: "Acceso App"               },
      { href: "/push/campaigns",        label: "Campañas Push"            },
    ],
  },
  {
    title: "Captura",
    links: [
      { href: "/captura/promovidos", label: "Promovidos"        },
      { href: "/captura/interna",    label: "Entrega Interna"   },
      { href: "/captura/externa",    label: "Entrega Externa"   },
    ],
  },
  {
    title: "Catálogos",
    links: [
      { href: "/organization/members",    label: "Miembros Organizacionales" },
      { href: "/catalogs/aid-types",   label: "Tipos de Apoyo"           },
      { href: "/catalogs/authorities", label: "Autoridades"              },
      { href: "/catalogs/cities",      label: "Ciudades"                 },
      { href: "/catalogs/communities", label: "Comunidades"              },
      { href: "/catalogs/routes",      label: "Rutas"                    },
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
  const router   = useRouter();

  const [isSidebarOpen,    setIsSidebarOpen]    = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["Operación", "Captura", "Catálogos"]));

  const {
    authError, isConfigured, isLoading, missingEnvVars,
    sessionUser, signOutCurrentUser,
  } = useAuth();

  const isLoginRoute = pathname === "/login";

  const activeSectionTitle = menuSections.find((section) =>
    section.links.some((l) => l.href === pathname),
  )?.title;

  useEffect(() => {
    if (!isConfigured || isLoading) return;
    if (!sessionUser && !isLoginRoute) { router.replace("/login"); return; }
    if (sessionUser && isLoginRoute)   router.replace("/");
  }, [isConfigured, isLoading, isLoginRoute, router, sessionUser]);

  function toggleSection(title: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  if (!isConfigured) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-3xl">
          <MissingConfigNotice missingVars={missingEnvVars} />
        </div>
      </main>
    );
  }

  if (isLoginRoute) return <LoginView>{children}</LoginView>;

  if (isLoading || !sessionUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100" suppressHydrationWarning>
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600">
          Validando sesion...
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px]" suppressHydrationWarning>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          suppressHydrationWarning
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 transform border-r border-slate-200 bg-white p-6 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      } lg:block`}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Entrega de Apoyos
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Back Office</h1>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <nav className="space-y-5">
          {menuSections.map((section) => {
            const isCollapsed = collapsedSections.has(section.title) && section.title !== activeSectionTitle;
            const hasCollapse = section.links.length > 1;
            return (
              <div key={section.title}>
                <button
                  type="button"
                  onClick={() => hasCollapse && toggleSection(section.title)}
                  className={`mb-1.5 flex w-full items-center justify-between ${hasCollapse ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </span>
                  {hasCollapse && (
                    <span
                      className="inline-block text-slate-500 transition-transform duration-200"
                      style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", fontSize: "0.85rem", lineHeight: 1 }}
                    >
                      ›
                    </span>
                  )}
                </button>

                {!isCollapsed && (
                  <ul className="space-y-0.5">
                    {section.links.map((link) => {
                      const isActive = pathname === link.href;
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setIsSidebarOpen(false)}
                            className={`block py-2 text-sm font-medium transition ${
                              isActive
                                ? "rounded-r-md border-l-[3px] border-slate-900 bg-slate-50 pl-[9px] pr-3 text-slate-900"
                                : "rounded-md px-3 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            {link.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-slate-500 hover:text-slate-700"
            >
              ☰
            </button>
            {authError && (
              <p className="text-xs text-rose-600">{authError}</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{sessionUser.name}</p>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {sessionUser.backofficeRole}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOutCurrentUser()}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cerrar sesion
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>

      <Toaster />
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
