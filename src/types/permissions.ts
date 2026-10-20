export const PERMISSIONS = ["capture", "reports", "catalogs", "admin"] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Permissions that can be assigned from the UI (admin is owner-only)
export const ASSIGNABLE_PERMISSIONS: readonly Permission[] = [
  "capture",
  "reports",
  "catalogs",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  capture:  "Captura",
  reports:  "Reportes",
  catalogs: "Catálogos",
  admin:    "Administración",
};
