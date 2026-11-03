import { NextResponse } from 'next/server';
import { ensureAdminSchema, pool } from '@/lib/db';
import { authUsername, hasFullAccess, verifyAuth } from '@/lib/auth';
import { parseScheduleInput } from '@/lib/eventSchedule';
import { logEvent } from '@/lib/eventLog';

const SUBMISSION_COLUMNS = `
  id, created_by, title, subtitle, details, status, category,
  start_date::text AS start_date,
  NULLIF(end_date::text, '') AS end_date,
  substring(start_time::text, 1, 5) AS start_time,
  substring(end_time::text, 1, 5) AS end_time,
  created_at, reviewed_at, reviewed_by
`;

type IncomingSlide = {
  title?: unknown;
  subtitle?: unknown;
  details?: unknown;
  category?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  start_time?: unknown;
  end_time?: unknown;
};

/**
 * Event admins manage their own submissions; super admins and the VC office
 * see every submission so they can review the pending queue.
 */
export async function GET(request: Request) {
  const user = verifyAuth(request);
  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  try {
    await ensureAdminSchema();

    const status = new URL(request.url).searchParams.get('status');
    const clauses: string[] = [];
    const values: string[] = [];

    if (!hasFullAccess(user)) {
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
 * Creates one or more pending submissions. Nothing goes live until a super
 * admin or VC office user approves each submission.
 */
export async function POST(request: Request) {
  const user = verifyAuth(request);
  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  try {
    await ensureAdminSchema();

    const body = await request.json();
    const incoming: IncomingSlide[] = Array.isArray(body.slides) ? body.slides : [body];

    const slides = [];
    for (const raw of incoming) {
      const slide = (raw ?? {}) as IncomingSlide;
      const title = String(slide.title ?? '').trim();
      const subtitle = String(slide.subtitle ?? '').trim();
      const details = String(slide.details ?? '').trim();
      if (!title && !subtitle && !details) continue;

      const schedule = parseScheduleInput(slide as Record<string, unknown>);
      if ('error' in schedule) {
        return NextResponse.json({ detail: schedule.error }, { status: 400 });
      }
      slides.push({ title, subtitle, details, ...schedule });
    }

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
          `INSERT INTO event_submissions
             (created_by, title, subtitle, details, status, category,
              start_date, end_date, start_time, end_time)
           VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
           RETURNING ${SUBMISSION_COLUMNS}`,
          [
            authUsername(user),
            slide.title,
            slide.subtitle,
            slide.details,
            slide.category,
            slide.start_date,
            slide.end_date,
            slide.start_time,
            slide.end_time,
          ]
        );
        const row = result.rows[0];
        created.push(row);
        await logEvent(client, {
          action: 'submitted',
          actor: authUsername(user),
          actorRole: String(user.role || 'admin'),
          targetUser: authUsername(user),
          submissionId: row.id,
          title: row.title,
          category: row.category,
          startDate: row.start_date,
          endDate: row.end_date,
          startTime: row.start_time,
          endTime: row.end_time,
          details: row.details,
        });
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
 * Event admins can edit their own pending/rejected submissions. Saving puts a
 * rejected submission back into the pending queue.
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

    const schedule = parseScheduleInput(body as Record<string, unknown>);
    if ('error' in schedule) {
      return NextResponse.json({ detail: schedule.error }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE event_submissions
       SET title = $1, subtitle = $2, details = $3, status = 'pending',
           category = $4, start_date = $5, end_date = $6,
           start_time = $7, end_time = $8,
           reviewed_at = NULL, reviewed_by = NULL
       WHERE id = $9 AND created_by = $10 AND status IN ('pending', 'rejected')
       RETURNING ${SUBMISSION_COLUMNS}`,
      [
        title,
        subtitle,
        details,
        schedule.category,
        schedule.start_date,
        schedule.end_date,
        schedule.start_time,
        schedule.end_time,
        id,
        authUsername(user),
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { detail: "Submission not found or can no longer be edited" },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    await logEvent(pool, {
      action: 'updated',
      actor: authUsername(user),
      actorRole: String(user.role || 'admin'),
      targetUser: row.created_by,
      submissionId: row.id,
      title: row.title,
      category: row.category,
      startDate: row.start_date,
      endDate: row.end_date,
      startTime: row.start_time,
      endTime: row.end_time,
      details: row.details,
    });

    return NextResponse.json({ submission: row });
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
       RETURNING ${SUBMISSION_COLUMNS}`,
      [id, authUsername(user)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { detail: "Submission not found or can no longer be deleted" },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    await logEvent(pool, {
      action: 'deleted',
      actor: authUsername(user),
      actorRole: String(user.role || 'admin'),
      targetUser: row.created_by,
      submissionId: row.id,
      title: row.title,
      category: row.category,
      startDate: row.start_date,
      endDate: row.end_date,
      startTime: row.start_time,
      endTime: row.end_time,
      details: row.details,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event submission:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}
