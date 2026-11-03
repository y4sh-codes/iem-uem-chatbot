import { pool } from "./db";

type QueryExecutor = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
};

export interface EventLogInput {
  action: string;
  actor: string;
  actorRole: string;
  targetUser?: string | null;
  submissionId?: number | null;
  title?: string | null;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  details?: string | null;
}

export interface EventLogRow {
  id: number;
  action: string;
  actor: string;
  actor_role: string;
  target_user: string | null;
  submission_id: number | null;
  title: string | null;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  details: string | null;
  created_at: string;
}

export interface EventLogFilters {
  from?: string | null;
  to?: string | null;
  user?: string | null;
  action?: string | null;
  limit?: number;
}

/** Append one audit row. Callers may pass a transaction client. */
export async function logEvent(executor: QueryExecutor, input: EventLogInput): Promise<void> {
  await executor.query(
    `INSERT INTO event_logs
       (action, actor, actor_role, target_user, submission_id, title, category,
        start_date, end_date, start_time, end_time, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      input.action,
      input.actor,
      input.actorRole,
      input.targetUser ?? null,
      input.submissionId ?? null,
      input.title ?? null,
      input.category ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
      input.startTime ?? null,
      input.endTime ?? null,
      input.details ?? null,
    ]
  );
}

const LOG_COLUMNS = `
  id, action, actor, actor_role, target_user, submission_id, title, category,
  start_date::text AS start_date,
  NULLIF(end_date::text, '') AS end_date,
  substring(start_time::text, 1, 5) AS start_time,
  substring(end_time::text, 1, 5) AS end_time,
  details, created_at
`;

/** List audit rows, newest first, with optional date/user/action filters. */
export async function queryEventLogs(filters: EventLogFilters = {}): Promise<EventLogRow[]> {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.from) {
    values.push(filters.from);
    clauses.push(`created_at >= $${values.length}::date`);
  }
  if (filters.to) {
    values.push(filters.to);
    clauses.push(`created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }
  if (filters.user) {
    values.push(filters.user);
    clauses.push(`(actor = $${values.length} OR target_user = $${values.length})`);
  }
  if (filters.action) {
    values.push(filters.action);
    clauses.push(`action = $${values.length}`);
  }

  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 5000);
  values.push(limit);

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT ${LOG_COLUMNS}
     FROM event_logs
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows as EventLogRow[];
}
