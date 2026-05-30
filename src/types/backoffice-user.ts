export type BackofficeUser = {
  uid:           string;
  email:         string;
  name:          string;
  backofficeRole: string;
  active:        boolean;
  createdAt:     Date | null;
};

export type CreateBackofficeUserPayload = {
  email:    string;
  password: string;
  name:     string;
  roleId:   string;
};

export type CreateBackofficeUserResult = {
  uid:   string;
  email: string;
};

export type UpdateBackofficeUserPayload = {
  uid:     string;
  name?:   string;
  roleId?: string;
  active?: boolean;
};
