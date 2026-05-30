"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./auth-provider";
import type { Permission } from "@/types/permissions";

type Props = { permission: Permission; children: React.ReactNode };

export function PermissionGuard({ permission, children }: Props) {
  const { sessionUser, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && sessionUser && !sessionUser.permissions.includes(permission)) {
      router.replace("/");
    }
  }, [isLoading, sessionUser, permission, router]);

  if (isLoading || !sessionUser) return null;
  if (!sessionUser.permissions.includes(permission)) return null;

  return <>{children}</>;
}
