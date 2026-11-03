import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { superAdminError } from '@/lib/auth';
import { ensureAdminSchema } from '@/lib/db';
import { queryEventLogs } from '@/lib/eventLog';

export const runtime = 'nodejs';

/** Download the filtered event audit log as a real .xlsx workbook. */
export async function GET(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;

  try {
    await ensureAdminSchema();

    const params = new URL(request.url).searchParams;
    const logs = await queryEventLogs({
      from: params.get('from'),
      to: params.get('to'),
      user: params.get('user'),
      action: params.get('action'),
      limit: 5000,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Event Log');
    sheet.columns = [
      { header: 'Logged at', key: 'created_at', width: 22 },
      { header: 'Action', key: 'action', width: 14 },
      { header: 'Actor', key: 'actor', width: 24 },
      { header: 'Role', key: 'actor_role', width: 14 },
      { header: 'Target user', key: 'target_user', width: 24 },
      { header: 'Event', key: 'title', width: 38 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Start date', key: 'start_date', width: 14 },
      { header: 'End date', key: 'end_date', width: 14 },
      { header: 'Start time', key: 'start_time', width: 10 },
      { header: 'End time', key: 'end_time', width: 10 },
      { header: 'Details', key: 'details', width: 60 },
    ];

    for (const row of logs) {
      sheet.addRow({
        ...row,
        created_at: row.created_at
          ? new Date(row.created_at).toLocaleString('en-IN')
          : '',
      });
    }

    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `event-log-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error("Error exporting event logs:", error);
    return NextResponse.json({ detail: "Internal error" }, { status: 500 });
  }
}
