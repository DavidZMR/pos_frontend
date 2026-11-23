export const ROLES = ['superadmin', 'admin', 'employee'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super administrador',
  admin: 'Administrador',
  employee: 'Empleado',
};

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  businessId: string | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  name: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  address?: string;
  timezone: string;
  ticket: { header: string; footer: string };
  settings: { allowNegativeStock: boolean };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  token: string;
  user: User;
  business: Business | null;
}
