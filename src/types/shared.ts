export type AuthorityType =
  | "delegate"
  | "sub_delegate"
  | "mayor"
  | "ejidal_commissioner";

export type Authority = {
  id: string;
  type: AuthorityType;
  name: string;
  phone: string;
  curp: string;
  birthDate: string;
};

export type AidUnit =
  | "pieza"
  | "paquete"
  | "litro"
  | "kg"
  | "tarjeta"
  | "MXN"
  | "otro";

export type AidType = {
  id: string;
  name: string;
  unit: AidUnit;
  active: boolean;
};

export type City = {
  id: string;
  name: string;
  state: string;
  delegateId: string | null;
  subDelegateId: string | null;
  mayorId: string | null;
  ejidalCommissionerId: string | null;
};

export type Community = {
  id: string;
  name: string;
  cityId: string | null;
  delegateId: string | null;
  subDelegateId: string | null;
  mayorId: string | null;
  ejidalCommissionerId: string | null;
};

export type OrgLevel = {
  id: string;
  name: string;
  rank: number;
  canUseApp: boolean;
  capabilities: string[];
  active: boolean;
};

export type RouteItem = {
  id: string;
  name: string;
  description: string | null;
};

export type OrgMember = {
  id: string;
  name: string;
  phone: string;
  curp: string;
  birthDate: string;
  levelId: string;
  parentId: string | null;
  path: string[];
  assignment: {
    cityId: string | null;
    communityId: string | null;
    routeId: string | null;
  };
  appUserId: string | null;
  active: boolean;
};

export type NamedEntity = {
  id: string;
  name: string;
};
