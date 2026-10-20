"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export default function Home() {
  const { sessionUser, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !sessionUser) return;
    const p = sessionUser.permissions;
    // Quien supervisa (admin, supervisor) aterriza en el panorama general (Reportes),
    // no en un formulario de captura, aunque también tenga el permiso "capture" --
    // ambos roles lo tienen, pero su identidad principal es de supervisión, no captura
    // diaria. "reports" se evalúa primero por eso, no "admin" como caso especial.
    if (p.includes("reports"))   { router.replace("/reports/charts");       return; }
    if (p.includes("capture"))   { router.replace("/captura/promovidos");  return; }
    if (p.includes("catalogs"))  { router.replace("/organization/members"); return; }
  }, [sessionUser, isLoading, router]);

  return null;
}
