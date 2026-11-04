import { NextResponse } from 'next/server';
import { ensureAdminSchema, pool } from '@/lib/db';
import { authUsername, superAdminError, verifyAuth } from '@/lib/auth';
import { logEvent } from '@/lib/eventLog';

const REQUEST_COLUMNS = `
  id, created_by, status, changes, summary, created_at, reviewed_at, reviewed_by
`;

function isObjectArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => item !== null && typeof item === 'object' && !Array.isArray(item)
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Super admin sees the pending change requests from VC-office users. */
export async function GET(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;

  try {
    await ensureAdminSchema();
    const result = await pool.query(
      `SELECT ${REQUEST_COLUMNS}
       FROM content_change_requests
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ requests: result.rows });
  } catch (error) {
    console.error("Error listing content change requests:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}

/**
 * VC-office users cannot publish content directly. Their edits become pending
 * requests until a super admin approves them.
 */
export async function POST(request: Request) {
  const user = verifyAuth(request);
  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  if (user.role !== 'vc_office') {
    return NextResponse.json(
      { detail: "Only VC office users submit change requests" },
      { status: 403 }
    );
  }

  try {
    await ensureAdminSchema();

    const body = await request.json().catch(() => ({}));
    const changes: Record<string, unknown> = {};
    const summaryParts: string[] = [];

    if (body.events !== undefined) {
      if (!isObjectArray(body.events)) {
        return NextResponse.json({ detail: "Invalid event banners" }, { status: 400 });
      }
      changes.events = body.events;
      summaryParts.push(`Event banners: ${body.events.length} image slide(s)`);
    }

    if (body.right_slides !== undefined) {
      if (!isObjectArray(body.right_slides)) {
        return NextResponse.json({ detail: "Invalid event panel slides" }, { status: 400 });
      }
      changes.right_slides = body.right_slides;
      summaryParts.push(`Event panel: ${body.right_slides.length} text slide(s)`);
    }

    if (body.top_ticker !== undefined) {
      if (!isStringArray(body.top_ticker)) {
        return NextResponse.json({ detail: "Invalid top ticker" }, { status: 400 });
      }
      changes.top_ticker = body.top_ticker;
      summaryParts.push(`Top ticker: ${body.top_ticker.length} item(s)`);
    }

    if (body.bottom_ticker !== undefined) {
      if (!isStringArray(body.bottom_ticker)) {
        return NextResponse.json({ detail: "Invalid bottom ticker" }, { status: 400 });
      }
      changes.bottom_ticker = body.bottom_ticker;
      summaryParts.push(`Bottom ticker: ${body.bottom_ticker.length} item(s)`);
    }

    if (summaryParts.length === 0) {
      return NextResponse.json({ detail: "No changes to submit" }, { status: 400 });
    }

    const summary = summaryParts.join('; ');
    const result = await pool.query(
      `INSERT INTO content_change_requests (created_by, changes, summary)
       VALUES ($1, $2::jsonb, $3)
       RETURNING ${REQUEST_COLUMNS}`,
      [authUsername(user), JSON.stringify(changes), summary]
    );

    await logEvent(pool, {
      action: 'requested',
      actor: authUsername(user),
      actorRole: 'vc_office',
      targetUser: authUsername(user),
      details: summary,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Sent to the super admin for approval.",
        request: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating content change request:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}
