import { NextResponse } from 'next/server';
import { ensureAdminSchema, pool } from '@/lib/db';
import { authUsername, superAdminError, verifyAuth } from '@/lib/auth';
import {
  defaultContent,
  type EventSlide,
  type KioskContent,
  type RightPanelSlide,
} from '@/lib/content';
import { logEvent } from '@/lib/eventLog';

const REQUEST_COLUMNS = `
  id, created_by, status, changes, summary, created_at, reviewed_at, reviewed_by
`;

/**
 * Only a super admin can approve or reject a VC-office content change. On
 * approval the proposed slices are merged into the live kiosk content.
 */
export async function POST(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;

  const user = verifyAuth(request)!;
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  const action = body.action;

  if (!Number.isInteger(id) || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ detail: "Invalid review request" }, { status: 400 });
  }

  await ensureAdminSchema();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT ${REQUEST_COLUMNS}
       FROM content_change_requests
       WHERE id = $1 AND status = 'pending'
       FOR UPDATE`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { detail: "Change request not found or already reviewed" },
        { status: 404 }
      );
    }

    const changeRequest = requestResult.rows[0];

    if (action === 'approve') {
      const contentResult = await client.query(
        'SELECT data FROM kiosk_content WHERE id = 1'
      );

      const content: KioskContent =
        contentResult.rows.length > 0
          ? contentResult.rows[0].data
          : structuredClone(defaultContent);

      const changes = changeRequest.changes as Record<string, unknown>;

      if (Array.isArray(changes.events)) {
        content.events = changes.events as EventSlide[];
      }
      if (Array.isArray(changes.right_slides)) {
        content.right_slides = changes.right_slides as RightPanelSlide[];
      }
      if (Array.isArray(changes.top_ticker)) {
        content.top_ticker = changes.top_ticker as string[];
      }
      if (Array.isArray(changes.bottom_ticker)) {
        content.bottom_ticker = changes.bottom_ticker as string[];
      }

      await client.query(
        `INSERT INTO kiosk_content (id, data)
         VALUES (1, $1)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [content]
      );
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    await client.query(
      `UPDATE content_change_requests
       SET status = $1, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2
       WHERE id = $3`,
      [status, authUsername(user), id]
    );

    await logEvent(client, {
      action: action === 'approve' ? 'request_approved' : 'request_rejected',
      actor: authUsername(user),
      actorRole: 'super_admin',
      targetUser: changeRequest.created_by,
      details: changeRequest.summary,
    });

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      status,
      message:
        action === 'approve'
          ? "Change approved and published."
          : "Change request rejected.",
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error reviewing content change request:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  } finally {
    client.release();
  }
}
