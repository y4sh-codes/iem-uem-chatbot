import { NextResponse } from 'next/server';
import { ensureAdminSchema, pool } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { authUsername, isSuperAdmin, verifyAuth } from '@/lib/auth';

export async function POST(request: Request) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ detail: "Only the super admin can create admin accounts" }, { status: 403 });
  }

  try {
    await ensureAdminSchema();
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ detail: "Username and password are required" }, { status: 400 });
    }

    const hashed_password = await bcrypt.hash(password, 10);

    // Accounts created here are always regular event admins.
    await pool.query(
      'INSERT INTO admin_users (username, hashed_password, role) VALUES ($1, $2, $3)',
      [username, hashed_password, 'admin']
    );

    return NextResponse.json({
      success: true,
      message: `Admin ${username} created by ${authUsername(user)}`,
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') { // Postgres unique violation
      return NextResponse.json({ detail: "Username already exists" }, { status: 400 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}
