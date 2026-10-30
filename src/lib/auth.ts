import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'dev-only-secret-change-in-production';

export interface AuthPayload {
  sub?: string;
  username?: string;
  role?: string;
  [key: string]: unknown;
}

export function verifyAuth(request: Request): AuthPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function isSuperAdmin(user: AuthPayload | null): boolean {
  return !!user && user.role === 'super_admin';
}

/** Username stored inside the verified token. */
export function authUsername(user: AuthPayload | null): string {
  return String(user?.username || user?.sub || '');
}

/** Standard 401 (no/invalid token) or 403 (not a super admin) response. */
export function superAdminError(request: Request): NextResponse | null {
  const user = verifyAuth(request);
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  return null;
}
