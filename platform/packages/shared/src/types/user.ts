export const UserRole = {
  OWNER: "owner",
  ADMIN: "admin",
  ENGINEER: "engineer",
  VIEWER: "viewer",
  AUDITOR: "auditor",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  mfaEnabled: boolean;
  lastLogin: Date | null;
  createdAt: Date;
}
