import type { AidUnit, AuthorityType } from "@/types/shared";

// El programa opera únicamente en el municipio de Felipe Carrillo Puerto -- el
// catálogo de Ciudades trae los 11 municipios de Quintana Roo (genérico, no
// específico del programa), pero Communities solo tiene datos bajo esta ciudad
// (ver TARGET_CITY en scripts/seed-communities.ts). Ofrecer las otras 10 en
// cualquier selector/filtro no tiene sentido -- nunca van a tener datos detrás.
export const PRIMARY_CITY_NAME = "Felipe Carrillo Puerto";

export function toNullableId(value: string): string | null {
  return value ? value : null;
}

export function formatDateInput(value: unknown): string {
  if (!value) return "";

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  return "";
}

export const aidUnitOptions: AidUnit[] = [
  "pieza", "paquete", "litro", "kg", "tarjeta", "MXN", "otro",
];

export const unitDisplayMap: Record<AidUnit, string> = {
  pieza: "Pieza",
  paquete: "Paquete",
  litro: "Litro",
  kg: "Kg",
  tarjeta: "Tarjeta",
  MXN: "MXN",
  otro: "Otro",
};

export const authorityTypeOptions: AuthorityType[] = [
  "delegate",
  "sub_delegate",
  "mayor",
  "ejidal_commissioner",
];

export const authorityTypeDisplayMap: Record<AuthorityType, string> = {
  delegate: "Delegado",
  sub_delegate: "Subdelegado",
  mayor: "Alcalde",
  ejidal_commissioner: "Comisariado Ejidal",
};
