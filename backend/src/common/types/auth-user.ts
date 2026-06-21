import type { Role } from '@prisma/client';

export interface AuthUser {
  userId: string;
  sessionId: string;
  email: string;
  role: Role;
}
