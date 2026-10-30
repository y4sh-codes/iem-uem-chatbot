import { NextResponse } from 'next/server';
import { ensureAdminSchema, pool } from '@/lib/db';
import { authUsername, isSuperAdmin, verifyAuth } from '@/lib/auth';
import { defaultContent, type KioskContent } from '@/lib/content';

/**
 * Super-admin review endpoint. Approving a pending submission appends its
 * slide to the live kiosk right-panel content; rejecting it only updates the
 * submission status. Both happen in a single transaction.
 */
export async function POST(request: Request) {
  const user = verifyAuth(request);
  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ detail: "Only the super admin can review submissions" }, { status: 403 });
  }

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

    const submissionResult = await client.query(
      `SELECT id, created_by, title, subtitle, details
       FROM event_submissions
       WHERE id = $1 AND status = 'pending'
       FOR UPDATE`,
      [id]
    );

    if (submissionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { detail: "Submission not found or already reviewed" },
        { status: 404 }
      );
    }

    const submission = submissionResult.rows[0];

    if (action === 'approve') {
      const contentResult = await client.query(
        'SELECT data FROM kiosk_content WHERE id = 1'
      );

      const content: KioskContent = contentResult.rows.length > 0
        ? contentResult.rows[0].data
        : structuredClone(defaultContent);

      const rightSlides = Array.isArray(content.right_slides) ? content.right_slides : [];
      content.right_slides = [
        ...rightSlides,
        {
          title: submission.title,
          subtitle: submission.subtitle,
          details: submission.details,
        },
      ];

      await client.query(
        `INSERT INTO kiosk_content (id, data)
         VALUES (1, $1)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [content]
      );
    }

    await client.query(
      `UPDATE event_submissions
       SET status = $1, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2
       WHERE id = $3`,
      [action === 'approve' ? 'approved' : 'rejected', authUsername(user), id]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true, status: action === 'approve' ? 'approved' : 'rejected' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error reviewing event submission:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  } finally {
    client.release();
  }
}
