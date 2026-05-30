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
    if (p.includes("capture"))   { router.replace("/captura/promovidos");  return; }
    if (p.includes("reports"))   { router.replace("/reports/charts");       return; }
    if (p.includes("operation")) { router.replace("/access/app-users");     return; }
    if (p.includes("catalogs"))  { router.replace("/organization/members"); return; }
    if (p.includes("admin"))     { router.replace("/admin/roles");          return; }
  }, [sessionUser, isLoading, router]);

  return null;
}
