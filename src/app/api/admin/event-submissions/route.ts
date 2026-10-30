import { NextResponse } from 'next/server';
import { ensureAdminSchema, pool } from '@/lib/db';
import { authUsername, isSuperAdmin, verifyAuth } from '@/lib/auth';

const SUBMISSION_COLUMNS = `
  id, created_by, title, subtitle, details, status,
  created_at, reviewed_at, reviewed_by
`;

/**
 * Event admins manage their own submissions; the super admin sees every
 * submission (so they can review the pending queue).
 */
export async function GET(request: Request) {
  const user = verifyAuth(request);
  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  try {
    await ensureAdminSchema();

    const status = new URL(request.url).searchParams.get('status');
    const clauses: string[] = [];
    const values: string[] = [];

    if (!isSuperAdmin(user)) {
      values.push(authUsername(user));
      clauses.push(`created_by = $${values.length}`);
    }
    if (status) {
      values.push(status);
      clauses.push(`status = $${values.length}`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT ${SUBMISSION_COLUMNS}
       FROM event_submissions
       ${where}
       ORDER BY created_at DESC`,
      values
    );

    return NextResponse.json({ submissions: result.rows });
  } catch (error) {
    console.error("Error listing event submissions:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}

/**
 * Creates one or more pending submissions. Nothing goes live until the
 * super admin approves each submission.
 */
export async function POST(request: Request) {
  const user = verifyAuth(request);
  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  try {
    await ensureAdminSchema();

    const body = await request.json();
    const incoming: unknown[] = Array.isArray(body.slides) ? body.slides : [body];
    const slides = incoming
      .map((raw) => {
        const slide = (raw ?? {}) as { title?: unknown; subtitle?: unknown; details?: unknown };
        return {
          title: String(slide.title ?? '').trim(),
          subtitle: String(slide.subtitle ?? '').trim(),
          details: String(slide.details ?? '').trim(),
        };
      })
      .filter((slide) => slide.title || slide.subtitle || slide.details);

    if (slides.length === 0) {
      return NextResponse.json(
        { detail: "Add a title, subtitle, or details before submitting" },
        { status: 400 }
      );
    }

    const created = [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const slide of slides) {
        const result = await client.query(
          `INSERT INTO event_submissions (created_by, title, subtitle, details, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING ${SUBMISSION_COLUMNS}`,
          [authUsername(user), slide.title, slide.subtitle, slide.details]
        );
        created.push(result.rows[0]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({ submissions: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating event submission:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}

/**
 * Event admins can edit their own pending/rejected submissions. Saving
 * puts a rejected submission back into the pending queue.
 */
export async function PUT(request: Request) {
  const user = verifyAuth(request);
  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  try {
    await ensureAdminSchema();

    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ detail: "Invalid submission id" }, { status: 400 });
    }

    const title = String(body.title ?? '').trim();
    const subtitle = String(body.subtitle ?? '').trim();
    const details = String(body.details ?? '').trim();
    if (!title && !subtitle && !details) {
      return NextResponse.json(
        { detail: "Add a title, subtitle, or details before submitting" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE event_submissions
       SET title = $1, subtitle = $2, details = $3,
           status = 'pending', reviewed_at = NULL, reviewed_by = NULL
       WHERE id = $4 AND created_by = $5 AND status IN ('pending', 'rejected')
       RETURNING ${SUBMISSION_COLUMNS}`,
      [title, subtitle, details, id, authUsername(user)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { detail: "Submission not found or can no longer be edited" },
        { status: 404 }
      );
    }

    return NextResponse.json({ submission: result.rows[0] });
  } catch (error) {
    console.error("Error updating event submission:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}

/** Event admins can delete their own pending/rejected submissions. */
export async function DELETE(request: Request) {
  const user = verifyAuth(request);
  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  try {
    await ensureAdminSchema();

    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isInteger(id)) {
      return NextResponse.json({ detail: "Invalid submission id" }, { status: 400 });
    }

    const result = await pool.query(
      `DELETE FROM event_submissions
       WHERE id = $1 AND created_by = $2 AND status IN ('pending', 'rejected')
       RETURNING id`,
      [id, authUsername(user)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { detail: "Submission not found or can no longer be deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event submission:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}
