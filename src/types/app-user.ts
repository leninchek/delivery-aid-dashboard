// ── Firestore: SystemUsers document ──────────────────────────────────────────

export type AppUser = {
  uid:                string;
  phone:              string;
  name:               string;
  type:               "app";
  orgMemberId:        string;
  active:             boolean;
  mustChangePassword: boolean;
  onboardingComplete: boolean;
  createdAt:          Date | null;
};

// ── API payloads ──────────────────────────────────────────────────────────────

export type CreateUserPayload = {
  phone:       string;
  levelId:     string;
  parentId:    string | null;
  cityId:      string | null;
  communityId: string | null;
  routeId:     string | null;
};

export type ResetPasswordPayload = {
  uid: string;
};

export type ToggleStatusPayload = {
  uid:    string;
  active: boolean;
};

// ── API responses ─────────────────────────────────────────────────────────────

export type CreateUserResult = {
  uid:             string;
  phone:           string;
  tempPassword:    string;
};

export type ResetPasswordResult = {
  tempPassword: string;
};
