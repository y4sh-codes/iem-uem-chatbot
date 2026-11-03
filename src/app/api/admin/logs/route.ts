import { NextResponse } from 'next/server';
import { superAdminError } from '@/lib/auth';
import { ensureAdminSchema } from '@/lib/db';
import { queryEventLogs } from '@/lib/eventLog';

/** Super-admin event audit log with optional date/user/action filters. */
export async function GET(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;

  try {
    await ensureAdminSchema();

    const params = new URL(request.url).searchParams;
    const limitParam = Number(params.get('limit'));
    const logs = await queryEventLogs({
      from: params.get('from'),
      to: params.get('to'),
      user: params.get('user'),
      action: params.get('action'),
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error listing event logs:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}
