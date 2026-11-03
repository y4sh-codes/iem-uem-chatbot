import { NextResponse } from 'next/server';
import { ensureAdminSchema, pool } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { superAdminError } from '@/lib/auth';

const CREATABLE_ROLES = ['admin', 'vc_office'] as const;
type CreatableRole = (typeof CREATABLE_ROLES)[number];

/** Super-admin view of every admin and the events they have posted. */
export async function GET(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;

  try {
    await ensureAdminSchema();

    const users = await pool.query(
      `SELECT u.id, u.username, u.role, u.created_at,
              COUNT(s.id)::int AS event_count,
              MAX(s.created_at) AS last_event_at
       FROM admin_users u
       LEFT JOIN event_submissions s ON s.created_by = u.username
       GROUP BY u.id
       ORDER BY u.created_at ASC, u.username ASC`
    );

    const events = await pool.query(
      `SELECT id, created_by, title, subtitle, status, category,
              start_date::text AS start_date,
              NULLIF(end_date::text, '') AS end_date,
              substring(start_time::text, 1, 5) AS start_time,
              substring(end_time::text, 1, 5) AS end_time,
              created_at, reviewed_at, reviewed_by
       FROM event_submissions
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ users: users.rows, events: events.rows });
  } catch (error) {
    console.error("Error listing admin activity:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;

  try {
    await ensureAdminSchema();
    const { username, password, role: rawRole } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ detail: "Username and password are required" }, { status: 400 });
    }

    const role: CreatableRole = (CREATABLE_ROLES as readonly string[]).includes(rawRole)
      ? (rawRole as CreatableRole)
      : 'admin';

    const hashed_password = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO admin_users (username, hashed_password, role) VALUES ($1, $2, $3)',
      [username, hashed_password, role]
    );

    const roleLabel = role === 'vc_office' ? 'VC office user' : 'Event admin';
    return NextResponse.json({
      success: true,
      message: `${roleLabel} ${username} created`,
      role,
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') { // Postgres unique violation
      return NextResponse.json({ detail: "Username already exists" }, { status: 400 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}

function roleLabel(role: string): string {
  if (role === 'super_admin') return 'Super admin';
  if (role === 'vc_office') return 'VC office';
  return 'Event admin';
}

/** Super admins can switch an account between the event-admin and VC-office roles. */
export async function PATCH(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;

  try {
    await ensureAdminSchema();

    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const role = body.role as CreatableRole;

    if (
      !Number.isInteger(id) ||
      !(CREATABLE_ROLES as readonly string[]).includes(role)
    ) {
      return NextResponse.json({ detail: "Invalid role change request" }, { status: 400 });
    }

    const target = await pool.query(
      'SELECT id, username, role FROM admin_users WHERE id = $1',
      [id]
    );

    if (target.rows.length === 0) {
      return NextResponse.json({ detail: "Admin not found" }, { status: 404 });
    }

    if (target.rows[0].role === 'super_admin') {
      return NextResponse.json(
        { detail: "Super admin roles cannot be changed" },
        { status: 400 }
      );
    }

    await pool.query('UPDATE admin_users SET role = $1 WHERE id = $2', [role, id]);

    return NextResponse.json({
      success: true,
      role,
      message: `${target.rows[0].username} is now ${roleLabel(role)}`,
    });
  } catch (error) {
    console.error("Error changing admin role:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}

/** Super admins can remove event-admin and VC-office accounts. */
export async function DELETE(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;

  try {
    await ensureAdminSchema();

    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isInteger(id)) {
      return NextResponse.json({ detail: "Invalid admin id" }, { status: 400 });
    }

    const target = await pool.query(
      'SELECT id, username, role FROM admin_users WHERE id = $1',
      [id]
    );

    if (target.rows.length === 0) {
      return NextResponse.json({ detail: "Admin not found" }, { status: 404 });
    }

    if (target.rows[0].role === 'super_admin') {
      return NextResponse.json(
        { detail: "Super admin accounts cannot be deleted" },
        { status: 400 }
      );
    }

    await pool.query('DELETE FROM admin_users WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      message: `${target.rows[0].username} deleted`,
    });
  } catch (error) {
    console.error("Error deleting admin:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}
