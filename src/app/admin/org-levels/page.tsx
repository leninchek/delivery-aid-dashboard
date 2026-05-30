"use client";

import { PermissionGuard } from "@/components/auth/permission-guard";
import OrgLevelsContent from "@/app/catalogs/org-levels/page";

export default function AdminOrgLevelsPage() {
  return (
    <PermissionGuard permission="admin">
      <OrgLevelsContent />
    </PermissionGuard>
  );
}
