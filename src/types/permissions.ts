export const PERMISSIONS = ["capture", "reports", "operation", "catalogs", "admin"] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Permissions that can be assigned from the UI (admin is owner-only)
export const ASSIGNABLE_PERMISSIONS: readonly Permission[] = [
  "capture",
  "reports",
  "operation",
  "catalogs",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  capture:   "Captura",
  reports:   "Reportes",
  operation: "Operación",
  catalogs:  "Catálogos",
  admin:     "Administración",
};
