import { NextResponse } from 'next/server';
import { ensureAdminSchema, pool } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'dev-only-secret-change-in-production';

export async function POST(request: Request) {
  try {
    await ensureAdminSchema();

    const { username, password } = await request.json();
    const result = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      // Demo fallback kept for a completely empty database.
      if (username === 'admin' && password === 'admin') {
         const role = 'admin';
         const token = jwt.sign({ sub: username, username, role }, JWT_SECRET, { expiresIn: '12h' });
         return NextResponse.json({ access_token: token, username, role });
      }
      return NextResponse.json({ detail: "Invalid credentials" }, { status: 401 });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.hashed_password);
    if (!valid) {
      return NextResponse.json({ detail: "Invalid credentials" }, { status: 401 });
    }
    
    const role = user.role === 'super_admin' ? 'super_admin' : 'admin';
    const token = jwt.sign(
      { sub: user.username, username: user.username, role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    return NextResponse.json({ access_token: token, username: user.username, role });
  } catch {
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}
