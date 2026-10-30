import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query('SELECT mime_type, data FROM uploaded_images WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const { mime_type, data } = res.rows[0];

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': mime_type,
        'Cache-Control': 'public, max-age=31536000, immutable'
      },
    });
  } catch (err) {
    console.error('Error fetching image:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  } finally {
    client.release();
  }
}
