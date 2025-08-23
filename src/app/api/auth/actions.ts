// src/app/api/auth/actions.ts
'use server';

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME, JWT_SECRET, type User, type UserRole } from '@/lib/auth-utils';

export async function verifyAuth(): Promise<{ isAuthenticated: boolean; user: User | null }> {
  const cookieStore = await cookies();
  const tokenCookie = await cookieStore.get(AUTH_COOKIE_NAME);

  if (!tokenCookie) {
    return { isAuthenticated: false, user: null };
  }
  if (!JWT_SECRET) {
    console.error("FATAL: JWT_SECRET not set, cannot verify auth.");
    return { isAuthenticated: false, user: null };
  }

  try {
    const decoded = jwt.verify(tokenCookie.value, JWT_SECRET) as { userId: string, username: string, role: UserRole, permissions: string[] };
    const user: User = {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        permissions: decoded.permissions || [],
    };
    return { isAuthenticated: true, user: user };
  } catch (error) {
    console.log("Token verification failed:", (error as Error).message);
    return { isAuthenticated: false, user: null };
  }
}
