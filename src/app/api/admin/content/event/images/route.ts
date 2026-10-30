import { NextResponse } from 'next/server';
import { superAdminError } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function POST(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;
  
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  
  if (!files || files.length === 0) {
    return NextResponse.json({ detail: "No files uploaded" }, { status: 400 });
  }

  const savedUrls: string[] = [];
  const client = await pool.connect();

  try {
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const filename = `${Date.now()}-${Math.round(Math.random() * 1000)}-${file.name}`;
      
      await client.query(
        'INSERT INTO uploaded_images (id, mime_type, data) VALUES ($1, $2, $3)',
        [filename, file.type, buffer]
      );
      
      savedUrls.push(`/api/images/${filename}`);
    }
  } finally {
    client.release();
  }

  return NextResponse.json({ urls: savedUrls });
}
