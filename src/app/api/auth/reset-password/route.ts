import { NextResponse } from 'next/server';
import { ensureAdminSchema, pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

/**
 * Self-service password reset. The user asked for no MFA and no old-password
 * check, so this endpoint intentionally only needs a username and new password.
 */
export async function POST(request: Request) {
  try {
    await ensureAdminSchema();

    const body = await request.json().catch(() => ({}));
    const username = String(body.username ?? '').trim();
    const newPassword = String(
      body.newPassword ?? body.new_password ?? body.password ?? ''
    );

    if (!username || !newPassword) {
      return NextResponse.json(
        { detail: 'Username and new password are required' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE admin_users
       SET hashed_password = $1
       WHERE username = $2
       RETURNING username`,
      [hashedPassword, username]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ detail: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated. You can sign in now.',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ detail: 'Internal error' }, { status: 500 });
  }
}
